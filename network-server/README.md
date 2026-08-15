# Senso Network Server — Self-Hosted ChirpStack

Deployment runbook for the LoRaWAN Network Server that sits between customer-site
gateways (SenseCAP M2) and our backend. See `MIGRATION.md` at the repo root for the
overall Pi → Dragino/LoRaWAN migration context.

**We deploy from the official upstream repo, not a fork checked in here** —
`chirpstack-docker` changes with each ChirpStack release, and a copy pasted into this
repo would silently rot. This doc is the layer on top: server sizing, DNS, firewall,
security hardening, and the resilience checklist, applied to that upstream project.

Verified 2026-07 against the official `chirpstack/chirpstack-docker` repo. Confirm
current details against upstream before deploying, since ChirpStack ships new majors
periodically.

---

## 1. Provision the VPS

- **Spec:** 2 vCPU / 4 GB RAM is comfortably enough for our scale (one gateway today,
  a modest fleet for a while). Scale up later if needed — nothing here is hard to resize.
- **Provider:** Hetzner or DigitalOcean are the usual picks for this — cheap, reliable,
  simple snapshots. ~$10–15/mo at this spec.
- **OS:** Ubuntu LTS (or your preference) with Docker + Docker Compose installed.

## 2. DNS — point a hostname you control at it

Set an **A record**, e.g. `lns.senso.com` → the VPS's IP, rather than hardcoding gateways
to a raw IP. If the server ever moves (bigger box, different provider, switch to managed
hosting), it's a DNS change instead of re-touching every deployed gateway. Do this now,
before any gateway is provisioned against it.

## 3. Deploy ChirpStack

```bash
git clone https://github.com/chirpstack/chirpstack-docker.git
cd chirpstack-docker
```

Services this brings up (confirmed from the upstream compose file): `chirpstack` (web UI
+ API, port 8080), `chirpstack-rest-api` (8090), `chirpstack-gateway-bridge` (Semtech UDP
packet forwarder, port 1700), `chirpstack-gateway-bridge-basicstation` (port 3001),
`mosquitto` (MQTT broker, 1883), `postgresql` (device/app data), `redis` (cache). All
configured with automatic restart by default.

Before `docker compose up`:

- **Set the region to EU868** — matches both the SenseCAP M2 and the Dragino LHT65N-E3.
  Region config lives under `configuration/chirpstack/region_*.toml` — enable EU868,
  disable regions we don't use.
- **Change every default credential.** The upstream compose ships with a placeholder
  Postgres user/password (`chirpstack`/`chirpstack`) meant for local testing only — set
  real secrets before this is reachable from the internet. Set a strong ChirpStack admin
  password on first login too.

```bash
docker compose up -d
```

## 4. Firewall — expose only what gateways need

- **Open to the internet:** the port your gateways will actually use to reach it —
  **UDP 1700** (Semtech packet forwarder) is the simpler mode to start with; **TCP 3001**
  (Basics Station, TLS-based) is the more production-grade option to move to later.
- **Keep closed / admin-only:** the ChirpStack **web UI (8080)** and **REST API (8090)** —
  restrict to an SSH tunnel, VPN, or IP allowlist. Don't expose the admin console to the
  open internet.
- **Internal only:** **Mosquitto (1883)** — only our backend's MQTT consumer needs this,
  not the public internet.

## 5. Point the SenseCAP M2 at it

The M2's local console (Wi-Fi AP or Ethernet setup page) has a **Packet Forwarder /
Basics Station mode** for pointing at an external network server — confirmed as
supported and documented by Seeed for pairing with ChirpStack specifically. Set it to:

- **Mode:** Packet Forwarder (start here) — server address `lns.senso.com`, port `1700`.
- Exact menu wording may vary by firmware version — Seeed publishes a
  "Connect M2 Multi-Platform Gateway to ChirpStack" guide; confirm field names against
  the actual device/current firmware rather than this doc if anything doesn't match.

On the ChirpStack side: register the gateway (its EUI, visible in the M2's console/label)
under a tenant, confirm it shows **connected** once the M2 is pointed at us.

## 6. Resilience checklist (do all of these before this carries real customer data)

- [ ] **Auto-restart** — confirm the compose file's restart policy is active (should be
      by default); a crashed container should recover in seconds, untouched.
- [ ] **Automated backups** — daily `pg_dump` of the Postgres volume (device configs,
      gateway registrations, join state), off the VPS.
- [ ] **VPS snapshots** — provider-level snapshot on a schedule, so a dead server is a
      redeploy-from-snapshot, not a rebuild-from-scratch.
- [ ] **External uptime monitor** — a free service (UptimeRobot, Healthchecks.io) pinging
      the server every minute, alerting you (not silently) if it goes down. This is what
      makes an outage *loud* instead of a silent gap in the compliance record.
- [ ] **Backend consumer resilience** — Phase 2 work: make sure our MQTT/webhook consumer
      itself doesn't silently drop messages during its own restarts.

Our 15-min reading cadence + 35-min sensor staleness threshold already tolerates a short
NS blip without any customer-visible effect — the goal here is "recovers in well under
that window and pages someone if it doesn't," not literal zero downtime (nobody has that).

## 7. Migration flexibility (for later)

Self-host now, move to managed hosting (e.g. chirphost) later if upkeep gets old — same
ChirpStack software either direction, no rebuild. Moving means: re-register devices/
gateways (scriptable via the ChirpStack API, or manual re-entry at small scale — we hold
every DevEUI/AppKey ourselves as a fallback), re-point each physical gateway's server
address, re-point our backend consumer. Effort scales with the number of gateways
deployed at the time, so revisit this before the fleet gets large if hosting is likely to
change.
