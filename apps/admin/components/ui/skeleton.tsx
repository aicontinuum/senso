import { cn } from "@/lib/utils";

// Placeholder block for loading states. Shapes should mirror the real content
// they stand in for — a skeleton whose proportions are wrong causes the layout
// jump it exists to prevent.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        "motion-reduce:animate-none",
        className,
      )}
    />
  );
}
