import { cn } from "@/lib/utils";

// A single choice from a short list, shown as one bordered group rather than a
// row of separate buttons, so it reads as one control with one answer.
//
// The selected segment lifts to the card surface with a hairline shadow; the
// track is the sunken surface. Neutral on purpose: this is state, not an
// action, and the design system keeps purple for actions and brand.
//
// Segments wrap on narrow viewports rather than overflowing the page.

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group; the visible label is the caller's. */
  "aria-label": string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex flex-wrap gap-1 rounded-control bg-sunken p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-button px-3.5 text-sm font-semibold tracking-tight",
              "transition-[background-color,color,box-shadow] duration-[--dur-fast] ease-[--ease-out]",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/32",
              selected
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
