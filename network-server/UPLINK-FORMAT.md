# ChirpStack Uplink Format — the `/api/ingest` contract

What ChirpStack's **v4 HTTP integration** POSTs to our backend for every uplink. This is
the contract Phase 4's ingest parser must consume.

Captured 2026-08-27 from the first real decoded reading of `sensor0`
(Dragino LHT65N-E3, DevEUI `a840419edb62011c`).

> ⚠️ **The current `/api/ingest` cannot parse this.** It expects the old Pi-forwarder
> shape — `{mac_address, readings:[{hardware_id, temperature, recorded_at}]}` — which is
> gone. The parser must be **replaced**, not extended.

---

## 1. Actual payload

```json
{
  "deduplicationId": "80166477-2482-43ab-a64e-088107a7c4fa",
  "time": "2026-08-27T14:39:44.530852140+00:00",
  "deviceInfo": {
    "tenantId": "ae2e1b59-bf1e-420f-a733-bfbf08eb8aca",
    "tenantName": "ChirpStack",
    "applicationId": "635fda7b-0428-495e-812f-027490bcaf9d",
    "applicationName": "senso-test",
    "deviceProfileId": "bc0b05d1-d5ec-4126-9451-42403f143a9f",
    "deviceProfileName": "Dargino LHT65N",
    "deviceName": "sensor0",
    "devEui": "a840419edb62011c",
    "deviceClassEnabled": "CLASS_A",
    "tags": {}
  },
  "devAddr": "01087309",
  "adr": true,
  "dr": 0,
  "fCnt": 0,
  "fPort": 2,
  "confirmed": false,
  "data": "zOEJqQHEAQj1f/8=",
  "object": {
    "BatV": 3.297,
    "TempC_SHT": 24.73,
    "Bat_status": 3,
    "Ext_sensor": "Temperature Sensor",
    "Hum_SHT": 45.2,
    "TempC_DS": 22.93,
    "Node_type": "LHT65N"
  },
  "rxInfo": [
    {
      "gatewayId": "2cf7f11081400088",
      "rssi": -102,
      "snr": -12,
      "channel": 4,
      "crcStatus": "CRC_OK"
    }
  ],
  "txInfo": {
    "frequency": 867300000,
    "modulation": { "lora": { "bandwidth": 125000, "spreadingFactor": 12, "codeRate": "CR_4_5" } }
  },
  "regionConfigId": "eu868"
}
```

*Verbatim capture — `deviceProfileName` shows `Dargino LHT65N` because the profile was
still misspelled at capture time; it has since been renamed `Dragino LHT65N`. Nothing in
the ingest path reads that field.*

## 2. Field mapping

| Source field | Meaning | Maps to |
|---|---|---|
| `deviceInfo.devEui` | Sensor identity | `sensors.hardware_id` (DevEUI) → resolve to `sensor_id` |
| `object.TempC_DS` | **External probe temp — the compliance-critical value** | `readings.temperature` (primary) |
| `object.TempC_SHT` | Built-in ambient temp | secondary/optional |
| `object.Hum_SHT` | Humidity % | `readings.humidity` (new nullable column) |
| `object.BatV` | Battery voltage | battery tracking / low-battery alert |
| `object.Bat_status` | Battery level 0–3 | optional |
| `time` | Server receive timestamp (ISO8601) | `readings.recorded_at` — **but see §4 on fPort 3** |
| `deduplicationId` | Unique per physical uplink | idempotency key |
| `rxInfo[].gatewayId` | Receiving gateway | `gateways.mac_address` (Gateway EUI) |
| `txInfo.modulation.lora.spreadingFactor` | Link quality proxy (SF7 good … SF12 weak) | optional diagnostics |
| `regionConfigId` | Always `eu868` for us | validation |

## 3. ⚠️ `TempC_DS` vs `TempC_SHT`

The payload carries **two temperatures**, and confusing them silently breaks the product:

- **`TempC_DS`** — the **external waterproof probe**, i.e. what's inside the
  fridge/freezer. **This is the compliance reading.**
- `TempC_SHT` — the unit's **internal** sensor, i.e. the room outside the fridge.

In the sample above they differ by ~2 °C on a desk. In a real freezer install they'd
differ by ~40 °C — and ingesting the wrong one would report a comfortable room
temperature while the freezer fails. Ingest `TempC_DS`.

A null/absent `TempC_DS` means the probe isn't seated in its jack — worth surfacing as a
device fault rather than storing silently.

## 4. Branch on `fPort` — not every uplink is a reading

| fPort | Contents | Handling |
|---|---|---|
| **2** | Normal sensor reading, **or** the sensor's answer to a datalog poll | **Both ingested** — told apart by the status byte, see below |
| 5 | Device status (firmware, band, battery) | Different structure — don't parse as a reading |
| 3 | Datalog in the decoder's other mode (not seen from our sensors) | Dropped |
| 1 | Config/downlink commands | Not a normal uplink |

Parse defensively per fPort; anything that isn't 2 must not fall through into the reading
path.

### Datalog answers come on fPort 2 (captured 2026-10-02)

Asked for a time range (downlink `0x31` + start + end as unix seconds + reply interval,
on fPort 1 — see README "Backfill from the sensor's memory"), an LHT65N answers **on
fPort 2**, not 3, with a frame of 11-byte records. Each record:

| Bytes | Field |
|---|---|
| 0–1 | External probe temperature, int16, 1/100 °C — the compliance value |
| 2–3 | Internal temperature, int16, 1/100 °C |
| 4–5 | Humidity, low 12 bits, 1/10 % |
| 6 | Status: low nibble = external sensor kind (1 = temperature probe); **bit 6 = answer to a poll; bit 7 = retransmission** |
| 7–10 | Unix time the reading was taken, by the sensor's own clock |

A live reading is also 11 bytes with neither bit 6 nor bit 7 set, which is how ingest
tells them apart (`apps/admin/lib/ingest/datalog.ts`). ChirpStack's decoder renders the
same records as the `DATALOG` string (`[probe, internal, humidity, time],…`) with the
time formatted in the server's zone and no zone named, so ingest reads the raw `data`
bytes for these frames and `object` for live ones.

> ⚠️ **Timestamps.** The top-level `time` is when *ChirpStack received the packet*. Right
> for a live reading; wrong for a datalog answer, whose readings are historical and
> carry their own time in bytes 7–10. The sensor's clock is its own: sensor 2 ran six
> minutes fast on 2026-10-02, so recovered readings are matched to the record by
> proximity, not equality (`lib/ingest/backfill.ts`).

## 5. Ingest requirements (Phase 4)

1. **Shared-secret header** on ChirpStack's HTTP integration, validated server-side;
   reject anything without it.
2. **Reject unknown DevEUIs.** Sensors are pre-created during onboarding, so a DevEUI we
   don't recognize means a mis-scan, a stray, or a test unit — it must never be written
   into a customer's compliance record. (This also closes the old fail-open device-auth
   item in `TODO.md`.)
3. **Idempotency** — dedupe on `deduplicationId`, and/or rely on the unique
   `(sensor_id, recorded_at)` index. *(DEVLOG records `readings_sensor_time_uniq` as
   already created — verify before adding it again.)*
4. **Validate `regionConfigId == "eu868"`** as a cheap guard against a device registered
   under the wrong region.
5. Reuse the existing alert/threshold logic behind the new front door.
