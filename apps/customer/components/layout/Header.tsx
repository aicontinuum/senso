"use client";

import { Menu } from "lucide-react";

interface Props {
  onMenuClick: () => void;
  customerName: string;
}

export function Header({ onMenuClick, customerName }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6 print:hidden">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 hover:bg-accent md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {customerName}
        </span>
      </div>
    </header>
  );
}
