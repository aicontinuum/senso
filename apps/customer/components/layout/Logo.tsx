"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/constants";

// Brand lockup for the top header bar, sized by height with `w-auto` so the
// artwork's own aspect ratio decides the width.
//
// It lives in the header rather than the sidebar so it stays put when the rail
// collapses — which is why there is no square mark variant.
//
// Falls back to the app name if the file is missing, so a bad deploy degrades to
// text rather than a broken-image icon.
export function Logo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="truncate text-lg font-bold tracking-tight">
        {APP_NAME}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset,
    // no optimisation or layout measurement needed, and <img> keeps the onError
    // fallback simple.
    <img
      src="/logo-wide.svg"
      alt={APP_NAME}
      onError={() => setFailed(true)}
      className="h-7 w-auto shrink-0"
    />
  );
}
