"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

// Brand mark for the sidebar header.
//
// Two artworks: the wide lockup when there is horizontal room, the square mark
// when the rail is collapsed. The mobile drawer always has room, so the switch is
// desktop-only (md:) and mirrors how the rest of the sidebar handles `collapsed`.
//
// Falls back to the app name if either file is missing, so a missing asset
// degrades to the previous text rather than a broken-image icon.
export function Logo({ collapsed }: { collapsed: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={cn(
          "flex-1 truncate px-1 text-lg font-bold tracking-tight",
          collapsed && "md:hidden",
        )}
      >
        {APP_NAME}
      </span>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset,
          no optimisation or layout measurement needed, and <img> keeps the
          onError fallback simple. */}
      <img
        src="/logo-wide.svg"
        alt={APP_NAME}
        onError={() => setFailed(true)}
        className={cn("h-6 w-auto shrink-0", collapsed && "md:hidden")}
      />
      {collapsed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo-mark.svg"
          alt={APP_NAME}
          onError={() => setFailed(true)}
          className="mx-auto hidden h-6 w-6 shrink-0 md:block"
        />
      )}
    </>
  );
}
