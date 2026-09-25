import { Lock } from "lucide-react";

// Where an owner login would find a control, the reason there is none: a
// lock and the name of the account that manages this. One shape for the
// sensor settings and the alert comment, so read-only reads the same
// everywhere the owner looks.
export function ManagedBy({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
