import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The Senso action button: a 10px softened rectangle (--radius-button), never a
// pill. Hover darkens one step and deepens the shadow, press scales to 0.985,
// and disabled drops to 45% opacity with its colours intact so the user can
// still read what the control would have done.
//
// Never stack two filled buttons side by side — pair `primary` with `secondary`
// or `ghost`. The design system's `gradient` variant is deliberately not ported:
// it is reserved for a marketing hero CTA, and there is no marketing surface here.
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-button font-semibold tracking-tight",
    "transition-[background-color,border-color,color,box-shadow,transform]",
    "duration-[--dur-fast] ease-[--ease-out]",
    "active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100",
    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/32",
    "disabled:pointer-events-none disabled:opacity-45",
  ],
  {
    variants: {
      variant: {
        primary:
          "border border-transparent bg-primary text-primary-foreground shadow-accent-sm hover:bg-primary-hover hover:shadow-accent",
        secondary:
          "border border-border bg-card text-foreground shadow-xs hover:border-border-strong hover:bg-sunken",
        soft: "border border-transparent bg-primary-soft text-primary hover:bg-brand-100",
        ghost:
          "border border-transparent bg-transparent text-muted-foreground hover:bg-sunken hover:text-foreground",
        danger:
          "border border-transparent bg-alert-500 text-white hover:brightness-[.94]",
        dark: "border border-transparent bg-inverse text-text-inverse hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3.5 text-sm",
        md: "h-10 px-4.5 text-base",
        lg: "h-12 px-6.5 text-md",
        icon: "size-9 px-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button> — for links styled as buttons. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
