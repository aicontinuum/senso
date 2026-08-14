# Migration: Raspberry Pi → Dragino / SenseCAP (LoRaWAN)

Moving the **end product** off the prototype stack (Raspberry Pi gateway + from-scratch
ESP32 sensors) onto off-the-shelf **LoRaWAN** hardware: a **SenseCAP** gateway and
**Dragino** sensors. The Pi + ESP32 rig stays as a **test bench**, not a product.

**The core shift:** raw LoRa → LoRaWAN. The gateway becomes a dumb radio bridge; a
**LoRaWAN Network Server (LNS)** now sits between the gateway and our backend, and our
integration point moves from "the Pi forwarder POSTs to `/api/ingest`" to "the LNS
delivers decoded uplinks to us via webhook/MQTT." The web platform (dashboards, alerts,
reports, thresholds, timezones, freshness-based status) is backend-agnostic and carries
over almost entirely.

Work through this list roughly top-to-bottom — later phases depend on earlier ones.

---

## Phase 0 — Verify hardware & decisions (blockers — do first)

Hardware on hand: **1× SenseCAP M2 Multi-Platform Indoor Gateway (SX1302), EU868**
(SKU 114992981) · **3× Dragino LHT65N Temp & Humidity Sensor, 868 MHz** (SKU 113990756).

- [x] **SenseCAP gateway model confirmed** — **SenseCAP M2 Multi-Platform (SX1302),
      EU868.** "Multi-Platform" speaks standard LoRaWAN to The Things Stack / ChirpStack /
      AWS — NOT the Helium-locked M1, so we're free to use our own LNS. ✓
- [x] **Dragino sensor model confirmed** — **LHT65N-E3, EU868** (external-probe variant,
      probe rated to −40 °C). Use case includes **freezers**, so the external probe is
      required, not optional. Deployment: body + antenna stay outside; only the probe
      runs in past the door gasket (clean RF, freezer-rated tip). ✓
- [ ] **Frequency band** — sensor and gateway are **both EU868 → they match each other.** ✓
      **OPEN:** verify 868 MHz (863–870) is permitted in **Qatar** (CRA short-range-device
      rules) before commercial deployment. Fine for bench/testing regardless.
- [ ] **Network Server** — recommended **The Things Stack** (confirmed compatible with the
      M2 Multi-Platform; built-in Dragino codecs; webhook + MQTT). Pending final go-ahead.

### Phase 0 remaining
- Confirm **The Things Stack** as the LNS (last decision blocking Phase 1).
- Regulatory homework: is **EU868 permitted in Qatar**? (Do before commercial deploy;
  not a blocker for bench testing.)

_Note: each sensor label carries its **DevEUI** + a **QR (AppKey)** — the LoRaWAN join
credentials used to onboard devices in Phase 1/3. Treat the AppKey/QR as secret._

## Phase 1 — Stand up the LoRaWAN network

- [ ] Register/configure the **SenseCAP gateway** to the chosen LNS; confirm it shows
      **connected** in the LNS console.
- [ ] Onboard the **Dragino sensor** via OTAA (DevEUI / AppEUI / AppKey from the box);
      confirm it **joins** and uplinks appear in the LNS console.
- [ ] Load/verify the **Dragino payload codec** in the LNS so uplinks decode to a
      temperature JSON (not raw bytes).
- [ ] Set the Dragino **uplink interval (TDC)** to 15 min; re-confirm the **35-min sensor
      staleness** threshold still fits.

## Phase 2 — Backend ingest path

- [ ] Decide the integration transport: **LNS webhook** vs **MQTT** consumer.
- [ ] Build the new ingest endpoint/consumer for the **LNS payload shape** (DevEUI,
      `decoded_payload`, `rx_metadata` incl. RSSI/SNR, `received_at`).
- [ ] Reuse the existing **alert / threshold / upsert** logic behind the new front door.
- [ ] Replace the per-gateway **Bearer-secret auth** with **LNS webhook auth**
      (signature / API key) or MQTT credentials.
- [ ] **Identity mapping:** store the **DevEUI** as the sensor `hardware_id`; the gateway
      **EUI** as the gateway id.
- [ ] **Delivery reliability:** run a persistent MQTT consumer, or confirm/handle the
      LNS webhook retry behavior, so a backend blip doesn't silently drop uplinks
      (this replaces the Pi's store-and-forward guarantee).

## Phase 3 — Provisioning workflow (order → set up → deploy)

- [ ] Admin flow to **register a new sensor**: enter DevEUI/AppKey → create the LNS end
      device → bind DevEUI → sensor → customer.
- [ ] Admin flow to **onboard a gateway**: register the gateway EUI, bind to customer/site.
- [ ] Derive **gateway liveness** from LNS gateway status (replaces `heartbeat.sh`).
- [ ] Write the **per-customer kit runbook**: order → provision → bench-test → ship →
      deploy on site.

## Phase 4 — Cut over & retire the Pi from the product path

- [ ] Run the Dragino + SenseCAP path **end-to-end into the dashboard in parallel** with
      the Pi for validation.
- [ ] Verify **readings, alerts, online/offline, and reports** all work off the LoRaWAN
      path.
- [ ] **Demote the Pi `gateway/` kit to test-only** — keep for the bench, mark it clearly.
- [ ] Update **DEVLOG / SENSO** docs to reflect the LoRaWAN architecture.

## Phase 5 — Loose ends & nice-to-haves

- [ ] Use **downlinks** to remotely reconfigure deployed sensors (interval / thresholds).
- [ ] Capture **RSSI / SNR** per uplink for signal-quality visibility (new data LoRaWAN
      gives you).
- [ ] Decide long-term **LNS economics** (TTN community vs The Things Industries paid vs
      ChirpStack self-host).
