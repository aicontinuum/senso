import { Badge } from "@/components/ui/badge";
import type { SensorState } from "@/lib/alert-state";

// One badge, one vocabulary, both screens. See lib/alert-state.ts for why.
const BADGE: Record<SensorState, { variant: "offline" | "alert" | "warn" | "ok"; label: string }> = {
  // Offline's grey, deliberately: this is a status, not a fault, and grey is the
  // design system's vocabulary for "no signal expected here".
  "not-in-service": { variant: "offline", label: "Not in service" },
  offline: { variant: "offline", label: "Offline" },
  breaching: { variant: "alert", label: "Alert" },
  "alert-open": { variant: "warn", label: "Alert open" },
  ok: { variant: "ok", label: "Online" },
};

export function SensorStatusBadge({
  state,
  className,
}: {
  state: SensorState;
  className?: string;
}) {
  const { variant, label } = BADGE[state];
  return (
    <Badge variant={variant} dot className={className}>
      {label}
    </Badge>
  );
}
