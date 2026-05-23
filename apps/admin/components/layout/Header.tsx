"use client";

import { Menu } from "lucide-react";

interface Props {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 hover:bg-accent md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block" />
      <span className="text-sm text-muted-foreground">Admin</span>
    </header>
  );
}
