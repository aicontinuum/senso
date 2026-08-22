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
| 3 | Register test sensor | ← **next** |
| 4 | ChirpStack → backend ingest | |
| 5 | Supabase schema updates | |

Infrastructure details live in **`network-server/README.md`** (as-built).
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

## Phase 3 — Register test sensor ← next

Needs a physical Dragino LHT65N-E3 on hand. Doing this **manually via the ChirpStack
dashboard** first, deliberately, to learn the flow before automating it via API.

- [ ] Create/confirm a device profile with the **official Dragino LHT65N decoder**.
- [ ] Register the sensor (DevEUI + join keys from its QR/box) under the test tenant,
      **region `eu868`**.
- [ ] Power the sensor; confirm **OTAA join** and a **decoded uplink** showing
      `TempC_DS`, `TempC_SHT`, `Hum_SHT`, `BatV`.
- [ ] **Accuracy checkpoint:** ice-water test — the probe should read ~0 °C.
- [ ] Set the uplink interval (**TDC**) to 15 min; re-confirm the **35-min sensor
      staleness** threshold still fits.

## Phase 4 — ChirpStack → backend ingest

Transport decided: **ChirpStack HTTP integration → Vercel `/api/ingest`** with a
**shared-secret header** (rather than an MQTT consumer).

- [ ] Wire the HTTP integration with the shared-secret header.
- [ ] Reshape the ingest parser to the decoded LoRaWAN JSON (DevEUI, `decoded_payload`,
      `rx_metadata` incl. RSSI/SNR, `received_at`).
- [ ] **Reject readings from any DevEUI not already registered** — an unknown device means
      a mis-scan or a stray, and must not be written into a compliance record. (This also
      closes the old fail-open device-auth item in `TODO.md`.)
- [ ] Reuse the existing alert / threshold / upsert logic behind the new front door.
- [ ] **Delivery reliability** — confirm/handle the integration's retry behavior so a
      backend blip doesn't silently drop uplinks (this replaces the Pi's store-and-forward
      guarantee).
- [ ] Derive **gateway liveness** from ChirpStack's gateway status (replaces
      `heartbeat.sh`).

## Phase 5 — Supabase schema updates

- [ ] `sensors.hardware_id` → **DevEUI** format.
- [ ] `gateways.mac_address` → **Gateway EUI** format.
- [ ] Add a nullable **`humidity`** column to `readings` (the LHT65N reports it).

---

## Onboarding model (confirmed)

Split into **office prep** and **site install**.

**Office prep (before driving out):**
- ChirpStack: create the customer's tenant/application; scan each Dragino QR to register
  sensors; attach the Dragino device profile (official decoder); register the gateway by
  its Gateway EUI. **Region `eu868` every time.**
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

1. **CRA type approval / EU868 legality in Qatar** — before commercial deployment.
2. **Docker bypasses ufw** — audit whether Postgres/Redis are internet-exposed
   (deferred; details and commands in `network-server/README.md` §5).
3. **Qatar trademark clearance for "Senso"** in the temperature-monitoring class — owning
   the domain does not clear the name for use.
4. **Resilience gaps** — automated DB backups, VPS snapshots, and an external uptime
   monitor are all still unconfigured (`network-server/README.md` §7).
5. Test gateway is on the dev **`HOME`** WiFi; production gateways go on customer networks.
