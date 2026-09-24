import type { BranchTally } from "@/lib/branches";

// The site's name at the weight of a section title, and beside it the same
// counts the summary bar shows, in the same tones, so a problem site is
// found by colour before its name is read.
export function BranchHeading({ name, tally }: { name: string; tally: BranchTally }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="text-base font-semibold tracking-tight">{name}</h3>
      {tally.online + tally.offline > 0 && (
        <p className="text-sm font-medium">
          <span className="text-ok-text">{tally.online} online</span>
          {tally.offline > 0 && <> · <span className="text-offline-text">{tally.offline} offline</span></>}
          {tally.alerts > 0 && <> · <span className="text-alert-text">{tally.alerts} alert{tally.alerts > 1 ? "s" : ""}</span></>}
        </p>
      )}
    </div>
  );
}

