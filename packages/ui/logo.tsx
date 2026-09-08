"use client";

import { useState } from "react";
import { cn } from "./cn";

// Brand lockup for the top header bar, sized by height with `w-auto` so the
// artwork's own aspect ratio decides the width.
//
// Falls back to the app name if the file is missing, so a bad deploy degrades to
// text rather than a broken-image icon. The name is passed in because the two
// apps use different ones.
export function Logo({
  appName,
  suffix,
  className,
}: {
  appName: string;
  /** Set on the admin app so the two sites are not mistaken for each other. */
  suffix?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={cn("truncate text-lg font-bold tracking-tight", className)}>
        {appName}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset,
          no optimisation or layout measurement needed, and <img> keeps the onError
          fallback simple. */}
      <img
        src="/logo-wide.svg"
        alt={appName}
        onError={() => setFailed(true)}
        className={cn("h-7 w-auto shrink-0", className)}
      />
      {/* Set as text rather than baked into a second SVG: the wordmark is outlined
          paths, so a <text> node inside it could not use the loaded brand font —
          an SVG referenced by <img> cannot reach external fonts and would fall
          back to whatever the device has. Here it renders in Poppins like every
          other heading, stays crisp at any size, and follows the theme. */}
      {suffix && (
        <span className="shrink-0 font-display text-lg font-bold tracking-tight text-foreground">
          / {suffix}
        </span>
      )}
    </span>
  );
}
