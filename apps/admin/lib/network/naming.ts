// The name a device carries on the network server: a fixed office label
// for the physical unit, for its whole life and every customer it
// serves. Mechanical on purpose: the last four characters of the EUI,
// readable off the label, unique in practice, and never in need of an
// update when the device moves. What the fridge *is* ("Walk-in fridge")
// is the Senso-side name, chosen at install and the customer's to change.
// Decided 2026-10-02.

const EUI_TAIL = 4;

export function networkName(kind: 'gateway' | 'sensor', eui: string): string {
  return `${kind === 'gateway' ? 'G' : 'S'}-${eui.slice(-EUI_TAIL)}`;
}
