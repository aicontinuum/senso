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
// Both are sized by height with `w-auto`, so either a tight crop or a padded
// square export renders correctly without touching this file.

type Variant = "wide" | "mark";

export function Logo({ collapsed }: { collapsed: boolean }) {
  // Tracked per artwork rather than as one shared flag. A shared flag latches:
  // collapsing requests the mark, and a single failure there would drop the wide
  // lockup too — permanently, since expanding again never clears it.
  const [failed, setFailed] = useState<Partial<Record<Variant, boolean>>>({});
  const fail = (variant: Variant) =>
    setFailed((prev) => ({ ...prev, [variant]: true }));

  return (
    <>
      {failed.wide ? (
        <span
          className={cn(
            "flex-1 truncate px-1 text-lg font-bold tracking-tight",
            collapsed && "md:hidden",
          )}
        >
          {APP_NAME}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- static brand asset,
        // no optimisation or layout measurement needed, and <img> keeps the
        // onError fallback simple.
        <img
          src="/logo-wide.svg"
          alt={APP_NAME}
          onError={() => fail("wide")}
          className={cn("h-6 w-auto shrink-0", collapsed && "md:hidden")}
        />
      )}

      {collapsed &&
        (failed.mark ? (
          <span className="mx-auto hidden text-lg font-bold tracking-tight md:block">
            {APP_NAME.charAt(0)}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo-mark.svg"
            alt={APP_NAME}
            onError={() => fail("mark")}
            className="mx-auto hidden h-6 w-auto shrink-0 md:block"
          />
        ))}
    </>
  );
}
