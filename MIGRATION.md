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

- [ ] **Confirm exact SenseCAP gateway model** and that it can run as a standard
      packet-forwarder to *our chosen* LNS (not locked to Helium / SenseCAP-only cloud).
- [ ] **Confirm exact Dragino sensor model + probe.** Verify the temperature range covers
      the coldest use case — **freezers need the external probe** (e.g. LHT65N-E5, rated
      to ~-40 °C); the internal sensor alone won't survive a freezer.
- [ ] **Confirm the LoRaWAN frequency band for Qatar** — gateway, sensor, and LNS
      frequency plan must all match, or nothing joins. (The old raw-LoRa firmware used
      ~903 MHz / US915; LoRaWAN in the region is likely a different plan.)
- [ ] **Choose the Network Server.** Recommended start: **The Things Stack** (hosted;
      Dragino + SenseCAP both first-class; built-in Dragino codecs; webhook + MQTT).
      Consider self-hosted **ChirpStack** later if per-device economics demand it.

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
