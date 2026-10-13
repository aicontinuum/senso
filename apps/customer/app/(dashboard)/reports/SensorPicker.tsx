import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Card, InlinePanel } from "@senso/ui";
import { cn } from "@/lib/utils";
import type { SensorShape } from "./report-model";

interface SensorPickerProps {
  sensors: SensorShape[];
  selectedIds: Set<string>;
  /** Whether every sensor "Select all" governs is selected. */
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleSensor: (id: string) => void;
  /** Tag each sensor with its branch. On when the list spans branches;
   *  off when one branch was chosen and the tag would say the same thing
   *  on every row. */
  showBranch: boolean;
  /** Remove a retired sensor from this page, for good. Absent for an owner
   *  login, which changes nothing on a member's account. */
  onHide?: (id: string) => Promise<string | null>;
}

const CHECKBOX = "size-4 shrink-0 accent-primary";
const ROW = "flex items-center gap-3 px-3 py-2.5 text-sm";

export function SensorPicker({
  sensors,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleSensor,
  showBranch,
  onHide,
}: SensorPickerProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);

  function openConfirm(id: string) {
    setHideError(null);
    setConfirmId(id);
  }

  // The panel stays open on failure so the error is read where the
  // decision was made; it closes only once the sensor is gone.
  async function hide(id: string) {
    if (!onHide) return;
    setHideError(null);
    setBusy(true);
    const error = await onHide(id);
    setBusy(false);
    if (error) setHideError(error);
    else setConfirmId(null);
  }

  if (sensors.length === 0) {
    return <p className="text-sm text-muted-foreground">No sensors available.</p>;
  }

  return (
    <Card tone="sunken" className="overflow-hidden">
      {/* "Select all" heads the list it controls, and the count says what it
          did — retired sensors are governed by it only in the deselect
          direction, which the number makes visible. */}
      <label className={cn(ROW, "cursor-pointer justify-between border-b border-hairline")}>
        <span className="flex items-center gap-3">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} className={CHECKBOX} />
          <span className="font-semibold">{allSelected ? "Deselect all" : "Select all"}</span>
        </span>
        <span className="tabular-nums text-xs text-muted-foreground">
          {selectedIds.size} of {sensors.length} selected
        </span>
      </label>

      {/* overscroll-contain: reaching the end of this list must not scroll the page behind it. */}
      <div className="max-h-64 divide-y divide-hairline overflow-y-auto overscroll-contain">
        {sensors.map((s) => {
          // Listed but not selectable: showing it explains why a sensor on their
          // dashboard is missing here, which silently omitting it would not.
          const reportable = s.commissionedAt !== null;
          const removable = onHide !== undefined && s.decommissionedAt !== null;
          return (
            <div key={s.id}>
              {/* The checkbox label covers the name and chips; the remove
                  button sits beside it, outside the label, so pressing it
                  never toggles the box. */}
              <div className={cn(ROW, !reportable && "opacity-60")}>
                <label
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-between gap-3",
                    reportable ? "cursor-pointer" : "cursor-not-allowed",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => onToggleSensor(s.id)}
                      disabled={!reportable}
                      className={CHECKBOX}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {showBranch && s.branchName && (
                      <Badge variant="outline" className="text-muted-foreground">{s.branchName}</Badge>
                    )}
                    {s.decommissionedAt && <Badge variant="offline">Retired</Badge>}
                    {!reportable && <Badge variant="offline">Not in service</Badge>}
                  </span>
                </label>
                {/* A retired sensor can be taken off this page, for good as
                    far as the customer is concerned; the readings stay on
                    record for the office. */}
                {removable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${s.name} from reports`}
                    title="Remove from reports"
                    className="-my-2 -mr-2 hover:text-alert-text"
                    onClick={() => openConfirm(s.id)}
                    disabled={confirmId === s.id}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              {confirmId === s.id && (
                <div className="border-t border-hairline bg-inset px-3 py-3">
                  <InlinePanel
                    title={`Remove ${s.name} from reports?`}
                    description="There is no way to undo this. Its readings stay on record."
                    error={hideError ?? undefined}
                    confirmLabel="Remove"
                    busyLabel="Removing…"
                    busy={busy}
                    danger
                    onConfirm={() => hide(s.id)}
                    onCancel={() => setConfirmId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
