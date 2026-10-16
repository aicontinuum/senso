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
  /** Fill the container, segments sharing the width equally, so the control
   *  lines up with the fields around it instead of sizing to its labels. Where
   *  the segments would be too narrow for a label, they fall into rows. */
  block?: boolean;
  /** On a brand-coloured surface the track is a tint of white, the
   *  selected segment solid white, so the control reads the same way. */
  tone?: "default" | "inverse";
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  block = false,
  tone = "default",
  className,
}: SegmentedControlProps<T>) {
  const inverse = tone === "inverse";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "gap-1 rounded-control p-1",
        inverse ? "bg-white/15" : "bg-sunken",
        block ? "grid w-full grid-cols-[repeat(auto-fit,minmax(6.75rem,1fr))]" : "inline-flex flex-wrap",
        className,
      )}
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
              // 40px tall on touch, where a finger lands; 32px from desktop width.
              "inline-flex h-10 items-center gap-1.5 rounded-button px-3.5 text-sm font-semibold tracking-tight lg:h-8",
              block && "justify-center",
              "transition-[background-color,color,box-shadow,transform] duration-[--dur-fast] ease-[--ease-out]",
              "active:scale-[0.97] motion-reduce:active:scale-100",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/32",
              selected && "bg-card text-foreground shadow-xs",
              !selected && (inverse ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"),
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
