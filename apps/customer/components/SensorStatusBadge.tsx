import { Badge } from "@/components/ui/badge";
import type { SensorState } from "@/lib/alert-state";

// One badge, one vocabulary, both screens. See lib/alert-state.ts for why.
const BADGE: Record<SensorState, { variant: "offline" | "alert" | "warn" | "ok"; label: string }> = {
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
