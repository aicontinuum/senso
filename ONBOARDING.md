# Onboarding Runbook — Adding a Sensor

Step-by-step for adding a **Dragino LHT65N-E3** to a customer who already has a
gateway on site. (Adding a *gateway* is a separate, longer job — see §6.)

The guiding rule: **everything that can be done at a desk is done at a desk.** You
should arrive on site with a sensor that has already joined, already decoded a
correct reading, and already been proven accurate. Site time is for mounting and
verifying, not debugging.

---

## 1. Unbox and record

Check the box has: sensor body, **external probe** (white cable, metal tip), and the
mounting bracket. The probe is not optional for fridge/freezer work — the LHT65N-E3
is the external-probe variant specifically.

From the sticker on the back of the unit, record:

| What | Looks like | Used for |
|---|---|---|
| **DevEUI** | `a840419edb62011c` | The sensor's identity — goes in ChirpStack *and* the website |
| **QR code** | — | Encodes the **AppKey**, the device's join credential |

> ⚠️ The **AppKey is a secret** — it's what lets the device join your network.
> Don't photograph labels into shared albums or paste them into public channels.
> The DevEUI on its own is just an ID and is not sensitive.

Plug the probe firmly into its jack on the sensor body until it seats. A probe that
isn't fully in produces uplinks with **no `TempC_DS` value**, which ingest rejects.

## 2. Register in ChirpStack

At `https://lns.sensoqa.com`:

1. **Applications** → the customer's application → **Devices** → **Add device**
2. Name it something recognisable (`kamachi-walkin-1`, not `sensor4`)
3. **DevEUI** — from the label
4. **Device profile** — `Dragino LHT65N` (EU868, LoRaWAN 1.0.3, OTAA, v4 decoder)
5. Submit, then on the **OTAA keys** tab enter the **AppKey** from the QR

> **Region must be `eu868`.** The ChirpStack config has all regions enabled, so
> nothing stops you picking the wrong one — the check happens at registration, not
> in config. Getting it wrong means the device never joins.

**Tenancy model:** one **tenant per customer**, one **application per branch**.
Gateways live at tenant level and are shared across that customer's applications.

## 3. Set the reporting interval

Devices ship at a **20-minute** default; our standard is **15 minutes**.

Device → **Queue** → enqueue a downlink:

| Field | Value |
|---|---|
| **fPort** | `1` |
| **Payload (HEX)** | `01000384` |

Class A devices only listen briefly after they transmit, so this sits pending until
the device's next uplink and then applies. **A pending downlink is not a failure.**

Confirm it took effect by watching uplink spacing drop from 20:00 to ~15:00.

## 4. Add to the website

Admin site → the customer → **Sensors** → **Add**:

- **Gateway** — the customer's existing gateway
- **Name** — what the customer will see (`Walk-in Freezer`, not `Sensor 3`).
  This is the label that appears on their dashboard and on compliance reports.
- **DevEUI** — same value as in ChirpStack

Then open the sensor and set:
- **Min / max thresholds** for what this unit is monitoring (a freezer and a salad
  fridge have very different ranges)
- **Alert recipients**

> Ingest **rejects any DevEUI it doesn't already know**, so this step is not
> optional — an unregistered device's readings are dropped, not queued.

## 5. Bench test — before you leave the office

1. **Power on** the sensor (press the **ACT** button per the box insert).
2. In ChirpStack, watch **Events** for a **join**, then an **uplink** on **fPort 2**
   whose decoded object contains `TempC_DS`, `TempC_SHT`, `Hum_SHT`, `BatV`.
3. Check the reading reaches the **website** — it should appear on the customer's
   dashboard within a few minutes.
4. **Ice-water accuracy check:** pack a cup with crushed ice, add cold water, stir,
   and immerse the probe tip for ~2 minutes. `TempC_DS` should read **≈ 0 °C**.
   This is the one test that proves the whole chain end to end, and it is the
   difference between "data is arriving" and "data is correct."

Do not go to site until all four pass.

## 6. Site install

1. **Mount the body OUTSIDE** the fridge/freezer; run only the probe inside, through
   the door gasket. A metal cabinet is a Faraday cage — a sensor mounted inside will
   drop packets. The seal closes over a cable this thin without leaking.
2. **Place the probe tip** where it reads the air around the product. Not pressed
   against a wall (reads the wall), not in the door's cold-air blast (reads colder
   than the food), not touching the evaporator.
3. **Wait for one uplink** and confirm it appears on the customer's dashboard.
4. **Check the spreading factor** on that uplink in ChirpStack. **SF7 is good, SF12
   is weak.** SF12 costs far more battery per transmit than SF7 — placement affects
   battery life more than the reporting interval does. If you see SF12/SF11,
   reposition the gateway or the sensor before leaving.
5. **Send a test alert** so the customer sees what one looks like and you've proven
   the email path.

## 7. Handover

- Show the customer their dashboard and where readings appear
- Confirm the alert recipient list with them
- Mark the sensor active and invoice on the admin side

**The customer only ever sees senso.com.** ChirpStack is internal infrastructure —
they should never be given a login or told it exists.

---

## Adding a gateway (summary)

Longer job; the parts that catch people out:

- **Configuring Wi-Fi over the gateway's own hotspot fails** — you're reconfiguring
  the link you're using, so it can't confirm and rolls back
  ("Failed to confirm apply within 90s"). **Connect over Ethernet first**, clear any
  stuck pending changes with Reset, set Wi-Fi, then Save & Apply. Bring a short
  Ethernet cable even to Wi-Fi-only sites.
- Prefer **Ethernet for permanent runtime** where the site has a port free.
- Packet forwarder config: mode **Packet Forwarder**, server `lns.sensoqa.com`,
  ports **1700** up and **1700** down.
- Register the **Gateway EUI** in ChirpStack (region `eu868`) *and* on the website.
- Mount it central and high, with line of sight toward the fridges where possible.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Never joins | Wrong AppKey, or registered under the wrong region |
| Joins, no readings on site | Check ingest logs — `unknown_device` means the DevEUI in Supabase doesn't match ChirpStack |
| Uplinks arrive, no `TempC_DS` | External probe not fully seated in its jack |
| Readings look like room temperature | Reading `TempC_SHT` (internal) instead of `TempC_DS` — or the probe isn't actually inside the fridge |
| Still 20-minute spacing | The interval downlink hasn't been delivered yet, or was queued on the wrong fPort |
| SF11/SF12 after mounting | Poor RF path — reposition before leaving, or battery life suffers badly |
