# Senso Gateway — Resilience Kit

Keeps a Raspberry Pi gateway (running **NetworkManager**) online across Wi-Fi
drops of any length — recovering on its own instead of needing a manual
power-cycle — and reports a liveness heartbeat so the platform knows fast when
a gateway goes silent.

## What it installs

1. **Stop the drop** — `wifi-powersave-off.conf` disables Wi-Fi power management.
   The Pi Zero 2W's radio can sleep after an AP drop and not wake cleanly; this
   is the single biggest cause of gateways that go silent and stay silent.
2. **Auto-reconnect** — `setup.sh` sets the Wi-Fi connection to `autoconnect`
   with **unlimited retries** (`autoconnect-retries 0`), so whenever the access
   point comes back — after 5, 10, or 30 minutes — the Pi rejoins on its own.
3. **Watchdog** — `net-watchdog.sh` (run every minute by `net-watchdog.timer`)
   pings a target and, if it stays unreachable, escalates: force-reconnect →
   restart NetworkManager → reboot. This catches the case where the driver or
   NetworkManager itself gets wedged and won't reconnect even though the AP is
   back.
4. **Heartbeat** — `heartbeat.sh` (run every 60s by `senso-heartbeat.timer`)
   POSTs a liveness pulse to `POST /api/heartbeat`. This is separate from
   temperature forwarding, so the platform can flag a gateway offline within a
   few minutes of it going silent — independent of the (slower) reading cadence,
   and even when no sensors are reporting. Reads its config from
   `/etc/senso/gateway.env`.
5. **Forwarder (store-and-forward)** — `senso_forwarder.py`, run as the
   `senso-forwarder.service` (`Restart=always`). Decodes LoRa uplinks and writes
   each reading to a durable SQLite queue (`/var/lib/senso/queue.db`); a sender
   thread flushes the queue to `POST /api/ingest` and only deletes rows the
   server confirms. If the network is down, readings pile up on disk and are
   backfilled with their original timestamps once it returns — **no gap in the
   report**. Same-payload uplinks (retransmits / multi-channel reports) are
   de-duplicated within a 60s window, and the backend's
   `UNIQUE(sensor_id, recorded_at)` index makes re-sends safe.
6. **Hardware watchdog** — `watchdog.conf` (a systemd drop-in) makes systemd pet
   the Pi's `/dev/watchdog`, and `dtparam=watchdog=on` enables the device. If the
   Pi ever freezes hard enough that systemd can't pet it (kernel hang, total
   lock-up), the **hardware forcibly resets the Pi**. This is the only thing that
   recovers a fully-frozen gateway — the software net-watchdog can't run if the
   OS itself is wedged. Applied on reboot.

## One-time database migration (store-and-forward)

Run once in Supabase so re-sends can't create duplicate rows:

```sql
DELETE FROM readings a USING readings b
 WHERE a.sensor_id = b.sensor_id AND a.recorded_at = b.recorded_at AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS readings_sensor_time_uniq ON readings(sensor_id, recorded_at);
```

## Install

Copy this folder to the Pi (e.g. `scp -r gateway senso@senso-gateway-01:~/`),
then on the Pi:

```bash
cd gateway
sudo ./setup.sh
```

On first run, `setup.sh` creates `/etc/senso/gateway.env` from the example and
prints an ACTION NEEDED line. Fill in your gateway's EUI and API base URL:

```bash
sudo nano /etc/senso/gateway.env      # set GATEWAY_MAC and API_BASE
sudo systemctl restart senso-heartbeat.timer
```

Then reboot to apply the Wi-Fi power-save setting:

```bash
sudo reboot
```

`setup.sh` deliberately does **not** restart NetworkManager, so running it over
an SSH-over-Wi-Fi session won't drop your connection mid-setup.

## Verify

```bash
iw dev wlan0 get power_save                 # expect: Power save: off
nmcli -f connection.autoconnect,connection.autoconnect-retries connection show <your-wifi>
                                            # expect: yes / 0
systemctl status net-watchdog.timer         # expect: active (waiting)
journalctl -t net-watchdog --since "10 min ago"   # watchdog activity
systemctl status senso-heartbeat.timer      # expect: active (waiting)
journalctl -t senso-heartbeat --since "5 min ago"  # heartbeat activity (quiet = success)
systemctl status senso-forwarder.service    # expect: active (running)
journalctl -u senso-forwarder -f            # live "Queued:" / "Flushed:" lines
sqlite3 /var/lib/senso/queue.db 'select count(*) from queue'   # unsent backlog (0 when caught up)
```

Hardware watchdog (after the reboot):
```bash
cat /sys/class/watchdog/watchdog0/state    # expect: active
systemctl show -p RuntimeWatchdogUSec       # expect: 15s (15000000)
```

**Outage test:** stop the network for ~15 min while the sensor keeps sending —
`select count(*) from queue` climbs as readings buffer. Restore the network and
the count drains to 0; the report for that window fills in instead of a gap.

To confirm the heartbeat is actually landing, watch the gateway's `last_seen_at`
in the database — it should update every ~60s.

Real-world test: switch the router/Wi-Fi off for ~10 minutes, then back on. The
Pi should rejoin by itself, readings resume, and the gateway flips back to
**Online** on the dashboard within a few minutes.

## Tuning

Thresholds live at the top of `net-watchdog.sh`:

| Variable | Default | Meaning |
|----------|---------|---------|
| `PING_TARGET`   | `1.1.1.1` | Host that defines "connected". A router IP works for LAN-only checks. |
| `BOUNCE_AFTER`  | `2`  | Minutes down before forcing a reconnect. |
| `RESTART_AFTER` | `5`  | Minutes down before restarting NetworkManager. |
| `REBOOT_AFTER`  | `15` | Minutes down before rebooting. Set to `0` to never reboot. |

After editing, re-run `sudo ./setup.sh` (or copy the script to
`/usr/local/bin/net-watchdog.sh`).
