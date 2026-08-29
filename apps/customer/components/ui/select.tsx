import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Dropdown matching Input's shape — same 12px --radius-control, same border and
// focus ring — with a chevron the native control does not draw consistently
// across platforms.

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, label, hint, error, id, disabled, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const describedById = error || hint ? `${selectId}-description` : undefined;

    return (
      <div className={cn("block w-full", wrapperClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-xs font-semibold text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "relative flex h-10 items-center rounded-control border bg-card shadow-xs",
            "transition-[border-color,box-shadow] duration-[--dur-fast] ease-[--ease-out]",
            "focus-within:ring-3 focus-within:ring-ring/32",
            error ? "border-alert-500" : "border-border focus-within:border-primary",
            disabled && "bg-inset opacity-60",
          )}
        >
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedById}
            className={cn(
              // appearance-none so the chevron below is the only one drawn.
              "h-full w-full appearance-none bg-transparent pl-3.5 pr-9 text-base font-medium text-foreground",
              // Same reason as Input: the design system's base layer draws a ring
              // on every select:focus-visible, and the wrapper already draws one.
              "outline-none focus-visible:shadow-none!",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 h-4 w-4 shrink-0 text-text-faint"
          />
        </div>
        {(error || hint) && (
          <p
            id={describedById}
            className={cn("mt-1.5 text-sm", error ? "text-alert-text" : "text-muted-foreground")}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
