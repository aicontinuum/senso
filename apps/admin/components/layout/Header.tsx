"use client";

import { Menu } from "lucide-react";
import { Logo } from "./Logo";

interface Props {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
      {/* Left slot: the brand, with the mobile menu button ahead of it. On
          desktop this replaces what was an empty spacer div holding the layout
          apart. */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 hover:bg-accent md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
      </div>
      <span className="text-sm text-muted-foreground">Admin</span>
    </header>
  );
}
