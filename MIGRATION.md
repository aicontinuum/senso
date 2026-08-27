# Migration: Raspberry Pi → LoRaWAN (SenseCAP + Dragino)

Moving the **end product** off the prototype stack (Raspberry Pi gateway + from-scratch
ESP32 sensors) onto off-the-shelf **LoRaWAN** hardware: a **SenseCAP** gateway and
**Dragino** sensors. The Pi + ESP32 rig stays as a **test bench**, not a product.

**The core shift:** raw LoRa → LoRaWAN. The gateway becomes a dumb radio bridge; a
**LoRaWAN Network Server (LNS)** now sits between the gateway and our backend, and our
integration point moves from "the Pi forwarder POSTs to `/api/ingest`" to "ChirpStack
delivers decoded uplinks to us." The web platform (dashboards, alerts, reports,
thresholds, timezones, freshness-based status) is backend-agnostic and carries over
almost entirely.

> **Phase numbering** follows the 2026-08-22 session summary: 1 = server, 2 = gateway,
> 3 = sensor, 4 = ingest, 5 = schema. (An earlier draft of this file numbered things
> differently — this is the current scheme.)

## Status at a glance

| Phase | | Status |
|---|---|---|
| 0 | Hardware & decisions | ✅ *(one regulatory item open)* |
| 1 | ChirpStack server stood up | ✅ |
| 2 | Gateway online | ✅ |
| 3 | First sensor registered + decoded uplink | ✅ |
| 4 | ChirpStack → backend ingest | ← **next** |
| 5 | Supabase schema updates | |

Infrastructure details live in **`network-server/README.md`** (as-built).
The exact uplink JSON and field mapping Phase 4 must consume is in
**`network-server/UPLINK-FORMAT.md`**.
Domain: **sensoqa.com** (Cloudflare) · LNS: **lns.sensoqa.com**

---

## Phase 0 — Hardware & decisions ✅

Hardware: **1× SenseCAP M2 Multi-Platform Indoor Gateway (SX1302), EU868**
(SKU 114992981) · **3× Dragino LHT65N-E3 Temp & Humidity Sensor, 868 MHz**
(SKU 113990756) · **1× RAK7266 WisGate SOHO Lite (non-LTE, EU868)** — R&D shelf.

- [x] **Gateway model** — SenseCAP M2 Multi-Platform (SX1302), EU868. "Multi-Platform"
      speaks standard LoRaWAN to any LNS — not the Helium-locked M1. **Chosen as the
      product standard**; the RAK7266 stays on the bench. Gateway choice is
      backend-invisible (ChirpStack normalizes every gateway's uplinks before our backend
      sees them), so a different model can be offered to specific customers later with no
      backend changes.
- [x] **Sensor model** — Dragino LHT65N-E3, EU868: the **external-probe** variant, probe
      rated to −40 °C. Required (not optional) because freezers are in scope. Deployment:
      body + antenna stay outside, only the probe runs in past the door gasket — clean RF
      and a freezer-rated tip.
- [x] **Band** — sensor and gateway are both EU868 and match. Validated in practice by the
      gateway registering and running on EU868.
- [x] **Network Server** — **ChirpStack, self-hosted.** Ruled out: free TTN (no
      SLA/control) and The Things Stack Cloud (~$200/mo). Managed ChirpStack (chirphost,
      ~€35/mo flat) remains an easy fallback — same software, no rebuild.
- [ ] **OPEN — regulatory:** confirm **CRA type approval / EU868 permitted in Qatar** for
      the Dragino + SenseCAP hardware. Not a blocker for bench testing; **is** a blocker
      before commercial deployment.

_Each sensor's label carries its **DevEUI** plus a **QR** encoding the join keys
(AppEUI/JoinEUI + AppKey) — the device's "passport." Treat the QR/AppKey as secret._

## Phase 1 — ChirpStack server ✅

Stood up on a Hostinger KVM VPS (Mumbai, Ubuntu 24.04), deployed via Docker from the
official `chirpstack-docker` repo, fronted by Caddy with Let's Encrypt HTTPS at
**https://lns.sensoqa.com**. Admin password changed from the default. ufw active.

Full detail — containers, DNS, TLS, region rule, ops commands, resilience checklist,
and the deferred Docker/ufw audit — is in **`network-server/README.md`**.

## Phase 2 — Gateway online ✅

| | |
|---|---|
| Hardware | SenseCAP M2 (console is OpenWrt 21.02 / LuCI-based) |
| **Gateway EUI** | **`2CF7F11081400088`** |
| ChirpStack name | `gateway1` — region **eu868**, stats interval 30, downlink priority 10 |
| Packet forwarder | Mode **Packet Forwarder** → `lns.sensoqa.com`, port **1700** up / **1700** down (server address entered via the `-- custom --` dropdown) |
| Link | Proven on Ethernet **and** WiFi; currently WiFi-only (dev SSID `HOME`) |
| Status | **Online** — live "last seen" heartbeat |

"Online" means the gateway is talking to ChirpStack and ready to relay — it has heard
from no sensor yet. That's Phase 3.

**Field learning — WiFi provisioning:** configuring WiFi *over the gateway's own hotspot
fails* (you're reconfiguring the link you're using, so it can't confirm and rolls back:
"Failed to confirm apply within 90s"). Working method: connect on **Ethernet** first →
**Reset** any stuck pending changes → set WiFi → Save & Apply → WiFi sticks, then
Ethernet can be unplugged. **Technicians should carry a short Ethernet cable even for
WiFi-only sites.** Prefer Ethernet for 24/7 runtime where available.

## Phase 3 — First sensor registered ✅ *(2026-08-27)*

Registered manually via the ChirpStack dashboard (deliberately, to learn the flow before
automating it via API). Full chain proven:
**sensor → LoRaWAN EU868 → SenseCAP M2 → ChirpStack → correct decoded JSON.**

| Object | Name | ID |
|---|---|---|
| Application | `senso-test` | `635fda7b-0428-495e-812f-027490bcaf9d` |
| Device profile | `Dragino LHT65N` | `bc0b05d1-d5ec-4126-9451-42403f143a9f` |
| Device | `sensor0` | DevEUI `a840419edb62011c`, DevAddr `01087309`, Class A |

**Device profile:** EU868 · LoRaWAN **1.0.3** · regional params **A (RP001 1.0.3)** ·
**OTAA** · expected uplink interval **900 s** (matches the 15-min cadence) · payload codec
= the official Dragino **ChirpStack 4.0** decoder from
`github.com/dragino/dragino-end-node-decoder`.

> ⚠️ **Must be the v4 decoder.** v3-era decoders throw `UPLINK_CODEC` errors on
> ChirpStack v4 — different function signature (`decodeUplink(input)`).

**Key findings:**
- **ADR works and matters a lot.** First uplinks were DR0/SF12 (weak, −102 RSSI); by the
  third, ADR had moved the device to DR5/SF7. SF7 uses dramatically less battery per
  transmit than SF12 — so **gateway placement affects battery life more than the reporting
  interval does.** Add "check spreading factor after mounting" to the technician checklist.
- **Class A downlink timing.** The device only listens briefly *after* it uplinks. Queued
  downlinks stay pending until the next uplink — a pending downlink is not a failure.
- Signal at the bench location is marginal (−102 RSSI); real installs need better placement.

**Accuracy verified ✓** — ice-water test passed, so the external probe reads true. This is
the same checkpoint the onboarding runbook asks technicians to repeat per install.

**Reporting interval: 15 min, set by downlink — verified working ✓**
Command `0x01` + 3 bytes of seconds on **fPort 1**; 15 min = 900 s = HEX **`01000384`**
(enqueue under Device → Queue, HEX).

Proven on `sensor0` 2026-08-27: uplinks ran at a clean 20:00 spacing (FCnt 0–3) until the
`txack` at 18:39:42 delivered the downlink in that uplink's RX window; the next uplink
(FCnt 4) arrived **18:54:44 — 15 min 2 s later**. No AT commands or USB access needed.

## Phase 4 — ChirpStack → backend ingest ← next

Transport decided: **ChirpStack HTTP integration → Vercel `/api/ingest`** with a
**shared-secret header** (rather than an MQTT consumer).

> 📄 **The exact payload, field mapping, and parsing rules are in
> `network-server/UPLINK-FORMAT.md`.** The current `/api/ingest` expects the old
> Pi-forwarder shape and must be **replaced**, not extended.

- [ ] Configure the HTTP integration on the `senso-test` application (Application →
      Integrations → HTTP) pointing at `/api/ingest`.
- [ ] **Rewrite the ingest parser** to the ChirpStack v4 JSON; implement the field mapping.
      Primary temperature is **`object.TempC_DS`** (external probe) — *not* `TempC_SHT`
      (internal ambient).
- [ ] **Shared-secret header** — set on the integration, validated server-side; reject
      requests without it.
- [ ] **Reject readings from any DevEUI not already registered** — an unknown device means
      a mis-scan or a stray, and must not enter a compliance record. (Also closes the old
      fail-open device-auth item in `TODO.md`.)
- [ ] **Idempotency** — dedupe on `deduplicationId` and/or the unique
      `(sensor_id, recorded_at)` index.
- [ ] **Branch by `fPort`** — only fPort 2 is a reading (5 = device status, 3 = datalog
      backfill, 1 = config). Suppress alerts on backfill, and **don't stamp fPort 3
      readings with the top-level `time`** (see UPLINK-FORMAT.md §4).
- [ ] Reuse the existing alert / threshold / upsert logic behind the new front door.
- [ ] **Delivery reliability** — confirm/handle the integration's retry behavior so a
      backend blip doesn't silently drop uplinks (this replaces the Pi's store-and-forward
      guarantee).
- [ ] Derive **gateway liveness** from ChirpStack's gateway status (replaces
      `heartbeat.sh`).

## Phase 5 — Supabase schema updates

- [ ] `sensors.hardware_id` → **DevEUI** format (e.g. `a840419edb62011c`).
- [ ] `gateways.mac_address` → **Gateway EUI** format (e.g. `2cf7f11081400088`).
- [ ] Add a nullable **`humidity`** column to `readings` (the LHT65N reports it).
- [ ] Unique constraint on **`(sensor_id, recorded_at)`** — *verify first: DEVLOG records
      `readings_sensor_time_uniq` as already created.*
- [ ] Consider a **`sites`/`branches`** table — `customers → sites → gateways/sensors`
      (see the tenancy decision below).

---

## Product decisions from Phase 3

**Tenancy: one tenant per customer, one application per branch.** ChirpStack has two
grouping levels — **Tenant** (= customer) and **Application** (a device group inside a
tenant); gateways live at tenant level, shared across a customer's applications.
**Implication:** multi-branch customers need a **`sites`/`branches`** layer in our own
schema (`customers → sites → gateways/sensors`) — the customer-facing grouping must exist
in our layer regardless of how ChirpStack organizes things.

**Reporting interval: 15 minutes, standard for every sensor.** *(Supersedes the earlier
per-customer tier idea — the 20/15/10 min tiers are scrapped.)* One interval everywhere
keeps provisioning, battery expectations, and absence-of-data detection uniform.

**How it's set:** the LHT65N ships at a 20-min default, so each new sensor gets the
`01000384` downlink (fPort 1) once during office prep — a queued command that applies on
the device's next uplink. Verified working; no physical access or AT commands needed.

This also **resolves the staleness collision**: at a 15-min cadence the existing **35-min**
`SENSOR_STALE_MS` in `@senso/status` tolerates one fully missed uplink plus margin — no
per-tier threshold logic needed, and the constant stays a single global value.

**Alert confirmation (designed, not built).** Don't alert on a single bad reading (a
door-open blip). Two models were defined; **Option B recommended** — a sustained-breach
rolling window: alert if ≥2 bad readings occur within a window and the breach isn't
clearly resolved by a run of good readings. (Option A — any single good reading resets
the pending state — misses a fridge flickering in and out of range.) The confirming
reading should come from a **shorter base interval**, *not* an on-demand "report now"
downlink: Class A downlinks aren't guaranteed and cost battery. This is **our** alert
engine (Supabase/Vercel state machine + `alert_notifications` audit table) — ChirpStack
just delivers every reading.

**Battery: measure, don't trust the spec.** Replaceable **CR17450 Li-MnO₂** cell (2 screws
on the back). Dragino claims 8–10 years, but that's best-case and real life depends
heavily on interval *and* signal (SF12 burns far more per transmit than SF7). Plan: track
**`BatV` from every uplink** and derive real fleet battery life over the first months.
Low-battery threshold ≈ **2.6 V** (Dragino's replace point), which should leave 1–2 weeks
of runway to dispatch a swap.

## Onboarding model (confirmed)

Split into **office prep** and **site install**.

**Office prep (before driving out):**
- ChirpStack: create the customer's tenant/application; scan each Dragino QR to register
  sensors; attach the Dragino device profile (official decoder); register the gateway by
  its Gateway EUI. **Region `eu868` every time.**
- **Queue the `01000384` interval downlink (fPort 1) for each sensor** — moves it from the
  20-min factory default to our 15-min standard; applies on the device's next uplink.
- senso.com: create the customer account and pre-create sensor/gateway records using the
  same DevEUIs.

**Site install:**
- Mount + power the gateway, get it online, confirm "online" in ChirpStack.
- Mount sensors, power on — **OTAA auto-joins**, no manual pairing. Watch the first
  decoded reading arrive.
- Name each sensor in the app (friendly label mapped onto its DevEUI).
- **Verify one reading is correct** before trusting it (ice-water, or compare against an
  existing thermometer) — a per-install verification checkpoint.
- Set alert thresholds + recipients; send a test alert.
- Hand over credentials; mark active + invoice on the admin side.

**Screens:** ChirpStack (device registration, internal only) · senso.com (naming, alerts)
· senso.admin (customer/billing). **The customer only ever sees senso.com.**

## After the five phases

- [ ] **API-based onboarding** — senso.admin calls the ChirpStack API to register devices
      behind the scenes (needs a ChirpStack API key). Build after doing the manual flow
      once.
- [ ] **Email alerts system** (plan already complete): inline threshold eval at ingest,
      `pg_cron` absence-of-data sweep, confirmation-delay state machine (two consecutive
      breaches), gateway rollup, backfill suppression, idempotency keys, and an
      `alert_notifications` audit table.
- [ ] **Upgrade Resend to Pro** before the first paying customer.
- [ ] **Cut over and retire the Pi from the product path** — run both in parallel for
      validation, verify readings/alerts/status/reports all work off LoRaWAN, then demote
      the Pi `gateway/` kit to test-only and mark it clearly.
- [ ] Update **DEVLOG / SENSO** docs to reflect the LoRaWAN architecture.
- [ ] Use **downlinks** to remotely reconfigure deployed sensors (interval, thresholds).
- [ ] Capture **RSSI / SNR** per uplink for signal-quality visibility.

## Open items carried forward

Phase 3 is fully closed — no outstanding items from it.

**Standing:**
1. **CRA type approval / EU868 legality in Qatar** — before commercial deployment.
2. **Docker bypasses ufw** — audit whether Postgres/Redis are internet-exposed
   (deferred; details and commands in `network-server/README.md` §5).
3. **Qatar trademark clearance for "Senso"** in the temperature-monitoring class — owning
   the domain does not clear the name for use.
4. **Resilience gaps** — automated DB backups, VPS snapshots, and an external uptime
   monitor are all still unconfigured (`network-server/README.md` §7).
5. Test gateway is on the dev **`HOME`** WiFi; production gateways go on customer networks.

_Credentials note: the `sensor0` AppKey and the ChirpStack admin password live in the
founder's password manager, deliberately not in this repo._
