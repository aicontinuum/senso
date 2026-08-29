"use client";

import { Menu } from "lucide-react";
import { Logo } from "./logo";

interface HeaderProps {
  onMenuClick: () => void;
  appName: string;
  /** Right-hand slot: the customer's name on one app, a role label on the other. */
  right?: React.ReactNode;
}

export function Header({ onMenuClick, appName, right }: HeaderProps) {
  return (
    // Three tracks rather than flex with justify-between, so the brand is centred
    // on the bar itself and not on whatever space the side content leaves over.
    // It stays centred as the right-hand content changes length.
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
        <Logo appName={appName} />
      </div>

      <div className="flex min-w-0 justify-end">
        {typeof right === "string" ? (
          <span className="truncate text-sm text-muted-foreground">{right}</span>
        ) : (
          right
        )}
      </div>
    </header>
  );
}
