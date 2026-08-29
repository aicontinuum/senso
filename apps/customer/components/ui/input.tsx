import * as React from "react";
import { cn } from "@/lib/utils";

// Single-line text field with optional label, unit suffix and error state.
//
// Radius is 12px (--radius-control), a touch rounder than a button — which is
// how "type here" reads differently from "press me" at a glance. Focus adds the
// purple ring; error turns the border alert and the hint red.
//
// Use `suffix` for units rather than baking them into the label.

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  /** Message shown in place of the hint; also switches the field to the alert border. */
  error?: string;
  /** Unit or short trailing token, e.g. "°C". */
  suffix?: string;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, label, hint, error, suffix, id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const describedById = error || hint ? `${inputId}-description` : undefined;

    return (
      <div className={cn("block w-full", wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-semibold text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex h-10 items-center gap-2 rounded-control border bg-card px-3.5 shadow-xs",
            "transition-[border-color,box-shadow] duration-[--dur-fast] ease-[--ease-out]",
            "focus-within:ring-3 focus-within:ring-ring/32",
            error ? "border-alert-500" : "border-border focus-within:border-primary",
            disabled && "bg-inset opacity-60",
          )}
        >
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedById}
            className={cn(
              "min-w-0 flex-1 border-none bg-transparent p-0 text-base font-medium text-foreground",
              // The design system's base layer puts the focus ring on every
              // input:focus-visible. Here the wrapper draws it instead, around
              // the whole control including its suffix — so the inner field has
              // to drop both the outline and that inherited shadow, or the two
              // rings nest visibly.
              //
              // Important is deliberate: the rule being overridden is an element
              // selector in a vendored file we do not edit, and it is unlayered
              // in dev, where unlayered CSS outranks every Tailwind utility no
              // matter its specificity. Scoped to this component, so raw inputs
              // elsewhere keep their focus indicator.
              "outline-none focus-visible:shadow-none!",
              "placeholder:text-text-faint",
              className,
            )}
            {...props}
          />
          {suffix && <span className="font-mono text-xs text-text-faint">{suffix}</span>}
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
Input.displayName = "Input";

export { Input };
