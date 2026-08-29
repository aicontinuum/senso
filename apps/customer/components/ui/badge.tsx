import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusTone } from "./status-dot";

// Status chips — the shared vocabulary for whether a reading, sensor or site is
// healthy. Radius is --radius-chip (8px), not a pill: the design system reserves
// pills for dots, avatars and counters.
//
// Tone is never decorative: `ok` in range, `warn` drifting toward a threshold,
// `alert` breached, `cold` freezer-specific readings, `offline` no signal.
//
// Each status variant pairs a soft fill with its own border and the readable end
// of the same ramp, which keeps the chip legible without a heavy fill.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        ok: "border-ok-border bg-ok-soft text-ok-text",
        warn: "border-warn-border bg-warn-soft text-warn-text",
        alert: "border-alert-border bg-alert-soft text-alert-text",
        cold: "border-cold-border bg-cold-soft text-cold-text",
        offline: "border-offline-border bg-offline-soft text-offline-text",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** Variants that carry a status tone, and so can show a matching dot. */
const DOT_TONES: readonly StatusTone[] = ["ok", "warn", "alert", "cold", "offline"];

function toneOf(variant: BadgeProps["variant"]): StatusTone | null {
  return DOT_TONES.includes(variant as StatusTone) ? (variant as StatusTone) : null;
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Prefix the label with a status dot. Only meaningful on a status variant. */
  dot?: boolean;
  /** Pulse the dot to mark a live reading. One per card, at most. */
  pulse?: boolean;
}

function Badge({ className, variant, dot, pulse, children, ...props }: BadgeProps) {
  const tone = toneOf(variant);
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && tone && <StatusDot status={tone} pulse={pulse} />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
