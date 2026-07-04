// Shared gateway-identifier handling for the ingest and heartbeat endpoints.
// Accepts the LoRa concentrator EUI (16 hex chars, no separators) as the
// primary format, plus the legacy colon-separated network MAC.

export function normaliseIdentifier(raw: string): string {
  const stripped = raw.replace(/[\s\-:]/g, '').toLowerCase();
  if (stripped.length === 16) return stripped;                             // LoRa EUI
  if (stripped.length === 12) return stripped.match(/.{2}/g)!.join(':'); // legacy MAC
  return raw.trim().toLowerCase();
}

export const EUI_RE = /^[0-9a-f]{16}$/;
export const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;

export function isValidGatewayId(id: string): boolean {
  return EUI_RE.test(id) || MAC_RE.test(id);
}
