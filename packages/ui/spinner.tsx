import { cn } from "./cn";

// CSS-only rather than an icon: one element, no icon-library dependency, and it
// picks up the Tailwind colour tokens so it matches in both apps unstyled.
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground",
        // Respect reduced-motion preferences — still visible, just not spinning.
        "motion-reduce:animate-none",
        className,
      )}
    />
  );
}
