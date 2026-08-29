// The single rule for "what state is this sensor in", used by every view.
//
// The dashboard card and the sensor page previously answered this differently —
// the card considered open alerts, the detail page only looked at the current
// reading — so the same sensor could read "Alert" on one screen and "Online" on
// the other. This exists so that cannot happen again.

export type SensorState =
  /** No recent reading; the device is silent. */
  | "offline"
  /** The current reading is outside its limits right now. */
  | "breaching"
  /** The reading has recovered, but the alert it raised is still open. */
  | "alert-open"
  /** In range, nothing outstanding. */
  | "ok";

export function sensorState(input: {
  isOffline: boolean;
  outOfRange: boolean;
  hasOpenAlert: boolean;
}): SensorState {
  if (input.isOffline) return "offline";
  if (input.outOfRange) return "breaching";
  // Deliberately distinct from "breaching": the fridge went out of range and has
  // come back, but nobody has acknowledged it. Showing this as plain "Online"
  // hides a real incident; showing it as a full alert overstates an urgent
  // problem that is no longer happening.
  if (input.hasOpenAlert) return "alert-open";
  return "ok";
}
