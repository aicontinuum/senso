// The single rule for "what state is this sensor in", used by every view.
//
// The dashboard card and the sensor page previously answered this differently —
// the card considered open alerts, the detail page only looked at the current
// reading — so the same sensor could read "Alert" on one screen and "Online" on
// the other. This exists so that cannot happen again.

export type SensorState =
  /**
   * Registered but not yet installed at the site, so it is not part of the
   * customer's compliance record. Its readings are real measurements of the
   * wrong thing — a bench, a van, a store cupboard — and are stored but never
   * reported or alerted on.
   */
  | "not-in-service"
  /** No recent reading; the device is silent. */
  | "offline"
  /** The current reading is outside its limits right now. */
  | "breaching"
  /** The reading has recovered, but the alert it raised is still open. */
  | "alert-open"
  /** In range, nothing outstanding. */
  | "ok";

export function sensorState(input: {
  inService: boolean;
  isOffline: boolean;
  outOfRange: boolean;
  hasOpenAlert: boolean;
}): SensorState {
  // Outranks everything, offline included. A sensor still in its box is not
  // "offline" in any sense worth showing as a fault, and a reading from one is
  // not in range or out of it — there is nothing yet for it to be measured
  // against.
  if (!input.inService) return "not-in-service";
  if (input.isOffline) return "offline";
  if (input.outOfRange) return "breaching";
  // Deliberately distinct from "breaching": the fridge went out of range and has
  // come back, but nobody has acknowledged it. Showing this as plain "Online"
  // hides a real incident; showing it as a full alert overstates an urgent
  // problem that is no longer happening.
  if (input.hasOpenAlert) return "alert-open";
  return "ok";
}
