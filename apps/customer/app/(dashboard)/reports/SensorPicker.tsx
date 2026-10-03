import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@senso/ui";
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hideError, setHideError] = useState<{ id: string; message: string } | null>(null);

  async function hide(id: string) {
    if (!onHide) return;
    setHideError(null);
    setBusyId(id);
    const error = await onHide(id);
    setBusyId(null);
    setConfirmId(null);
    if (error) setHideError({ id, message: error });
  }

  if (sensors.length === 0) {
    return <p className="text-sm text-muted-foreground">No sensors available.</p>;
  }

  return (
    <Card tone="sunken" className="overflow-hidden">
      {/* "Select all" heads the list it controls, and the count says what it
          did — retired sensors are governed by it only in the deselect
          direction, which the number makes visible. */}
      <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-hairline px-3 py-2.5 text-sm">
        <span className="flex items-center gap-3">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} className={CHECKBOX} />
          <span className="font-semibold">{allSelected ? "Deselect all" : "Select all"}</span>
        </span>
        <span className="tabular-nums text-xs text-muted-foreground">
          {selectedIds.size} of {sensors.length} selected
        </span>
      </label>

      <div className="max-h-64 divide-y divide-hairline overflow-y-auto">
        {sensors.map((s) => {
          // Listed but not selectable: showing it explains why a sensor on their
          // dashboard is missing here, which silently omitting it would not.
          const reportable = s.commissionedAt !== null;
          return (
            <label
              key={s.id}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors",
                reportable ? "cursor-pointer hover:bg-inset" : "cursor-not-allowed opacity-60",
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
              {s.decommissionedAt && (
                <Badge variant="offline" className="shrink-0">Retired</Badge>
              )}
              {!reportable && (
                <Badge variant="offline" className="shrink-0">Not in service</Badge>
              )}
              {/* A retired sensor can be taken off this page. Its readings
                  stay, and the confirmation says so. */}
              {onHide && s.decommissionedAt && (confirmId === s.id ? (
                <span className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                  <span className="text-xs text-muted-foreground">Remove from reports? Its readings are kept.</span>
                  <Button variant="danger" size="sm" onClick={() => hide(s.id)} disabled={busyId === s.id}>{busyId === s.id ? "Removing…" : "Remove"}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)} disabled={busyId === s.id}>Cancel</Button>
                </span>
              ) : (
                <span className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                  {hideError?.id === s.id && <span className="text-xs text-alert-text">{hideError.message}</span>}
                  <Button variant="ghost" size="icon" aria-label={`Remove ${s.name} from reports`} title="Remove from reports" className="hover:text-alert-text" onClick={() => setConfirmId(s.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              ))}
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}
