import { cn } from "@/lib/utils";

// The smallest unit of state in Senso: a coloured dot.
//
// A pill radius is correct here — the design system reserves it for dots,
// avatars and counters, and nothing else.
//
// Never render more than one pulsing dot per card, and always pair a dot with a
// text label: colour must never be the only signal.

export type StatusTone = "ok" | "warn" | "alert" | "cold" | "offline";

const TONE_FILL: Record<StatusTone, string> = {
  ok: "bg-ok-500",
  warn: "bg-warn-500",
  alert: "bg-alert-500",
  cold: "bg-cold-500",
  offline: "bg-offline-500",
};

interface StatusDotProps {
  status: StatusTone;
  /** Marks a reading that is currently streaming. One per card, at most. */
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ status, pulse = false, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        TONE_FILL[status],
        // The keyframes come from the design system's base layer.
        pulse && "motion-safe:animate-[senso-pulse_2s_var(--ease-out)_infinite]",
        className,
      )}
    />
  );
}
