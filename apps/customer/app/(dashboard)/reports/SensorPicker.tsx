import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SensorShape } from "./report-model";

interface SensorPickerProps {
  sensors: SensorShape[];
  selectedIds: Set<string>;
  /** Whether every sensor "Select all" governs is selected. */
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleSensor: (id: string) => void;
}

const CHECKBOX = "size-4 shrink-0 accent-primary";

export function SensorPicker({
  sensors,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleSensor,
}: SensorPickerProps) {
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
              {s.decommissionedAt && (
                <Badge variant="offline" className="shrink-0">Retired</Badge>
              )}
              {!reportable && (
                <Badge variant="offline" className="shrink-0">Not in service</Badge>
              )}
            </label>
          );
        })}
      </div>
    </Card>
  );
}
