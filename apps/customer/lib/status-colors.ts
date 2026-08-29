// Design-system status colours as RGB triples, for renderers that cannot read CSS.
//
// The screen reads these tones through Tailwind utilities backed by
// packages/tokens/colors.css. jsPDF has no stylesheet, so the report's PDF export
// needs the same values as numbers — otherwise a breach is one red on screen and
// a different red in the document an inspector reads.
//
// Mirrors packages/tokens/colors.css. Keep in sync when the design system is
// re-exported; these are the only hard copies of those values in the app.

export type StatusTone = "ok" | "warn" | "alert" | "cold" | "offline";

type Rgb = readonly [number, number, number];

/** Solid tone — dots, fills, chart lines. */
export const STATUS_RGB: Record<StatusTone, Rgb> = {
  ok: [0x12, 0xa1, 0x50],
  warn: [0xe9, 0xa2, 0x3b],
  alert: [0xe5, 0x48, 0x4d],
  cold: [0x2e, 0x9a, 0xd6],
  offline: [0xa0, 0xa0, 0xb4],
};

/** The readable text tone of each ramp — darker, for type on a light ground. */
export const STATUS_TEXT_RGB: Record<StatusTone, Rgb> = {
  ok: [0x0a, 0x70, 0x38],
  warn: [0x8a, 0x5a, 0x0b],
  alert: [0xa6, 0x16, 0x1b],
  cold: [0x0f, 0x5f, 0x8c],
  offline: [0x55, 0x55, 0x6a],
};

/** Neutrals used by the report's own chrome. */
export const NEUTRAL_RGB = {
  primary: [0x17, 0x16, 0x1c],
  secondary: [0x55, 0x55, 0x6a],
  muted: [0x75, 0x75, 0x89],
  faint: [0xa0, 0xa0, 0xb4],
  rule: [0xe2, 0xe2, 0xea],
} as const satisfies Record<string, Rgb>;
