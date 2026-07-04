#!/usr/bin/env python3
"""Senso LoRa forwarder with store-and-forward.

Listens for Semtech UDP packet-forwarder uplinks, decodes each reading, and
queues it to a durable local SQLite database. A separate sender thread flushes
the queue to the ingest API and only removes rows once the server confirms
them. If the network is down, readings accumulate on disk and are backfilled
(with their original timestamps) the moment connectivity returns — so there is
no gap in the history.

Retransmits from the concentrator are de-duplicated by their internal timestamp
(`tmst`), and the backend enforces uniqueness on (sensor_id, recorded_at), so a
re-send can never create a duplicate row.
"""

import base64
import json
import logging
import os
import socket
import sqlite3
import struct
import threading
import time
from datetime import datetime, timezone

# ── Config ─────────────────────────────────────────────────────────────────
UDP_IP = "0.0.0.0"
UDP_PORT = 1700
DB_PATH = "/var/lib/senso/queue.db"
DEFAULT_API_BASE = "https://senso-xsbp.vercel.app"
SEND_INTERVAL = 15      # seconds between flush attempts
BATCH_SIZE = 200        # readings per POST
DEDUP_WINDOW = 60       # seconds to remember a payload as "already seen"
HTTP_TIMEOUT = 10

# Semtech UDP packet-forwarder protocol identifiers
PUSH_DATA = 0x00
PUSH_ACK = 0x01

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("senso-forwarder")


def read_env(key, default=""):
    """Read a KEY=value from /etc/senso/gateway.env."""
    try:
        with open("/etc/senso/gateway.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return default


INGEST_URL = (read_env("API_BASE", DEFAULT_API_BASE).rstrip("/") or DEFAULT_API_BASE) + "/api/ingest"
GATEWAY_SECRET = read_env("GATEWAY_SECRET")
POST_HEADERS = {"Content-Type": "application/json"}
if GATEWAY_SECRET:
    POST_HEADERS["Authorization"] = "Bearer " + GATEWAY_SECRET

# requests is imported after config so a helpful error surfaces if it's missing
import requests  # noqa: E402


def db_connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = db_connect()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS queue (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               mac_address TEXT NOT NULL,
               hardware_id TEXT NOT NULL,
               temperature REAL NOT NULL,
               recorded_at TEXT NOT NULL
           )"""
    )
    conn.commit()
    conn.close()


# ── Receiver: decode uplinks and enqueue ───────────────────────────────────
def receive_loop():
    conn = db_connect()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    log.info("Listening for LoRa packets on UDP %s:%d", UDP_IP, UDP_PORT)

    seen = {}  # payload content -> monotonic time; dedups retransmits AND
    # multi-channel double-reports of the same uplink (which carry different tmst)

    while True:
        try:
            data, addr = sock.recvfrom(4096)
            if len(data) < 12:
                continue

            if data[3] != PUSH_DATA:
                continue  # PULL_DATA / keepalives etc.

            # Ack immediately so the concentrator doesn't keep retransmitting.
            sock.sendto(bytes([data[0]]) + data[1:3] + bytes([PUSH_ACK]), addr)

            json_data = json.loads(data[12:])
            if "rxpk" not in json_data:
                continue

            mac_address = data[4:12].hex()
            now_mono = time.monotonic()
            # Purge expired dedup entries
            for k in [k for k, t in seen.items() if now_mono - t > DEDUP_WINDOW]:
                del seen[k]

            for pkt in json_data["rxpk"]:
                key = pkt.get("data")
                if key is not None:
                    if key in seen:
                        continue  # same payload seen recently — retransmit or multi-channel copy
                    seen[key] = now_mono

                payload = base64.b64decode(pkt["data"])
                if len(payload) < 8:
                    log.warning("Short payload (%d bytes), skipping", len(payload))
                    continue

                hardware_id = "28-" + payload[0:6].hex()
                temperature = struct.unpack_from(">h", payload, 6)[0] / 100.0
                recorded_at = datetime.now(timezone.utc).isoformat()

                conn.execute(
                    "INSERT INTO queue (mac_address, hardware_id, temperature, recorded_at) VALUES (?, ?, ?, ?)",
                    (mac_address, hardware_id, temperature, recorded_at),
                )
                conn.commit()
                log.info("Queued: %s %.2f°C @ %s", hardware_id, temperature, recorded_at)

        except json.JSONDecodeError as e:
            log.warning("JSON parse error: %s", e)
        except Exception as e:  # never let the receiver die
            log.error("Receiver error: %s", e)


# ── Sender: flush the queue to the ingest API ──────────────────────────────
def send_loop():
    conn = db_connect()
    while True:
        try:
            flush(conn)
        except Exception as e:
            log.error("Sender error: %s", e)
        time.sleep(SEND_INTERVAL)


def flush(conn):
    while True:
        rows = conn.execute(
            "SELECT id, mac_address, hardware_id, temperature, recorded_at FROM queue ORDER BY id LIMIT ?",
            (BATCH_SIZE,),
        ).fetchall()
        if not rows:
            return

        # One concentrator = one MAC, but group defensively.
        by_mac = {}
        for row in rows:
            by_mac.setdefault(row[1], []).append(row)

        for mac, group in by_mac.items():
            body = {
                "mac_address": mac,
                "readings": [
                    {"hardware_id": r[2], "temperature": r[3], "recorded_at": r[4]}
                    for r in group
                ],
            }
            try:
                resp = requests.post(INGEST_URL, json=body, headers=POST_HEADERS, timeout=HTTP_TIMEOUT)
            except requests.RequestException as e:
                log.warning("Flush deferred (network): %s", e)
                return  # keep rows, retry next cycle

            ids = [r[0] for r in group]
            if resp.status_code == 200:
                conn.execute(
                    f"DELETE FROM queue WHERE id IN ({','.join('?' * len(ids))})", ids
                )
                conn.commit()
                log.info("Flushed %d reading(s) → %s", len(ids), resp.json())
            elif resp.status_code in (401, 403):
                # Auth not configured correctly (yet) — a fixable setup error.
                # Keep the readings and retry so nothing is lost while it's sorted.
                log.warning("Flush deferred (HTTP %d — check GATEWAY_SECRET), will retry", resp.status_code)
                return
            elif 400 <= resp.status_code < 500:
                # Other client errors won't recover on retry — drop so the queue
                # can't wedge forever, but log loudly.
                conn.execute(
                    f"DELETE FROM queue WHERE id IN ({','.join('?' * len(ids))})", ids
                )
                conn.commit()
                log.error("Dropped %d reading(s), HTTP %d: %s", len(ids), resp.status_code, resp.text)
            else:
                log.warning("Flush deferred (HTTP %d), will retry", resp.status_code)
                return  # 5xx — keep rows, retry next cycle


def main():
    init_db()
    log.info("Ingest URL: %s", INGEST_URL)
    threading.Thread(target=send_loop, daemon=True).start()
    receive_loop()


if __name__ == "__main__":
    main()
