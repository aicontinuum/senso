// LoRaWAN DevEUI handling for sensors — the counterpart to `gateway-id.ts`.
//
// A DevEUI is the sensor's permanent hardware identity, printed on the device
// label and encoded in its QR: 16 hex characters, e.g. `a840419edb62011c`. It is
// what ChirpStack reports as `deviceInfo.devEui`, and what we store in
// `sensors.hardware_id`.
//
// Replaces the DS18B20 1-Wire address format (`28-xxxxxxxxxxxx`) used by the
// retired ESP32 prototype. Existing rows in that format are left alone — they
// belong to decommissioned sensors — but new sensors are LoRaWAN.

/** Strip whatever separators were pasted (label, QR scan, vendor sheet) and lowercase. */
export function normaliseDevEui(raw: string): string {
  return raw.replace(/[\s\-:]/g, '').toLowerCase();
}

export const DEVEUI_RE = /^[0-9a-f]{16}$/;

export function isValidDevEui(id: string): boolean {
  return DEVEUI_RE.test(id);
}

// The AppKey is the sensor's join secret, printed beside the DevEUI on the
// label: 32 hex characters. It goes to the network server once and is
// never stored on our side.

export function normaliseAppKey(raw: string): string {
  return raw.replace(/[\s\-:]/g, '').toLowerCase();
}

export const APPKEY_RE = /^[0-9a-f]{32}$/;

export function isValidAppKey(key: string): boolean {
  return APPKEY_RE.test(key);
}
