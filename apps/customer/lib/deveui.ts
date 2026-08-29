// Display formatting for a sensor's DevEUI.
//
// The DevEUI is the device's permanent LoRaWAN identity, assigned at manufacture
// and stored in `sensors.hardware_id`. Reports show it alongside the name so a
// record stays traceable when a customer renames a sensor.
//
// It is an identifier, not a credential: the device's join secret is its AppKey,
// which lives on the label's QR code and never touches this system. Knowing a
// DevEUI grants nothing — joining the network needs the AppKey, and posting a
// reading needs the ingest secret.
//
// Note it identifies the *device*, not the monitoring point. Replacing a failed
// sensor starts a new identity in the record, which is the honest outcome: those
// readings did come from a different instrument.

/** Groups of four, uppercased — long enough to read back against a device label
 *  without losing your place, short enough for a table cell. */
export function formatDevEui(hardwareId: string | null | undefined): string | null {
  if (!hardwareId) return null;
  const clean = hardwareId.replace(/[\s\-:]/g, "").toUpperCase();
  if (clean.length === 0) return null;
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}
