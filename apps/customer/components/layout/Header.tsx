"use client";

import { Menu } from "lucide-react";
import { Logo } from "./Logo";

interface Props {
  onMenuClick: () => void;
  customerName: string;
}

export function Header({ onMenuClick, customerName }: Props) {
  return (
    // Three tracks rather than flex with justify-between, so the brand is centred
    // on the bar itself and not on whatever space the side content leaves over.
    // The middle track is sized to the logo; the outer two share the remainder
    // equally, which keeps it centred even as the customer name changes length.
    <header className="grid h-(--topbar-height) shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b bg-card px-4 sm:px-6 print:hidden">
      <div className="flex min-w-0 justify-start">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 hover:bg-accent md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex justify-center">
        <Logo />
      </div>

      <div className="flex min-w-0 justify-end">
        <span className="truncate text-sm text-muted-foreground">
          {customerName}
        </span>
      </div>
    </header>
  );
}
