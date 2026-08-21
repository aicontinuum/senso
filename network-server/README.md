# Senso Network Server — Self-Hosted ChirpStack

Deployment runbook for the LoRaWAN Network Server that sits between customer-site
gateways (SenseCAP M2) and our backend. See `MIGRATION.md` at the repo root for the
overall Pi → Dragino/LoRaWAN migration context.

**Native install (apt + systemd), not Docker.** ChirpStack v4 unifies what used to be a
separate Network Server + Application Server into a **single binary**, configured
through **one file**: `/etc/chirpstack/chirpstack.toml` — simpler than the old v3 split.
Installing via ChirpStack's own apt repo + systemd matches the ops model already used on
the Pi gateway kit (`systemctl`, `journalctl`, services) rather than introducing Docker as
a second paradigm. This doc is the layer on top of the official install steps: server
sizing, DNS, firewall, security hardening, and the resilience checklist.

Confirm current package names / apt repo URL / config keys against ChirpStack's live docs
when actually on the box — exact details shift between releases and shouldn't be trusted
from a static copy pasted here.

---

## 1. Provision the VPS

- **Spec:** 2 vCPU / 4 GB RAM is comfortably enough for our scale (one gateway today,
  a modest fleet for a while). Scale up later if needed — nothing here is hard to resize.
- **Provider:** Hetzner or DigitalOcean are the usual picks for this — cheap, reliable,
  simple snapshots. ~$10–15/mo at this spec.
- **OS:** Ubuntu LTS.

## 2. DNS — point a hostname you control at it

Set an **A record**, e.g. `lns.senso.com` → the VPS's IP, rather than hardcoding gateways
to a raw IP. If the server ever moves (bigger box, different provider, switch to managed
hosting), it's a DNS change instead of re-touching every deployed gateway. Do this now,
before any gateway is provisioned against it.

## 3. Deploy ChirpStack (native)

Install order:

1. **PostgreSQL** (apt) — create the `chirpstack` database + a dedicated user with a real
   (not default/example) password.
2. **Redis** (apt) — ChirpStack's cache layer.
3. **Mosquitto** (apt) — the MQTT broker ChirpStack talks through internally, and what
   our backend consumer subscribes to in Phase 2.
4. **ChirpStack + `chirpstack-gateway-bridge`** — from ChirpStack's own apt repo. The
   gateway-bridge is still a separate service even in v4 — it's what translates the
   SenseCAP M2's Semtech UDP packets (port 1700) into what ChirpStack expects internally.
   (We're using Packet Forwarder/UDP mode on the M2 to start — see §5 — so this is the
   bridge we need; Basics Station is a later upgrade path, confirm at that point whether
   v4 needs a separate bridge for it or handles it natively.)

Configure `/etc/chirpstack/chirpstack.toml`:

- Point it at the local Postgres / Redis / Mosquitto.
- **Region: EU868 only** — matches both the SenseCAP M2 and the Dragino LHT65N-E3.
- Set a strong ChirpStack admin password on first login.

Start everything via systemd:

```bash
systemctl enable --now postgresql redis-server mosquitto chirpstack chirpstack-gateway-bridge
```

**End state:** the ChirpStack web UI (port 8080) loads and you can log in.

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

- [ ] **Auto-restart** — confirm each systemd unit restarts on failure (`Restart=always`
      / `systemctl is-enabled`), same pattern as the Pi's `senso-forwarder.service`; a
      crashed process should recover in seconds, untouched.
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
