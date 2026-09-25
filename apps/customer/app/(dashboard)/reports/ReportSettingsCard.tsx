import { Download, FileText, Table } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@senso/ui";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { SensorPicker } from "./SensorPicker";
import { ALL_BRANCHES, hasBranches } from "@/lib/branches";
import {
  FORMATS,
  RANGES,
  type RangeValue,
  type ReportFormat,
  type SensorShape,
} from "./report-model";

interface ReportSettingsCardProps {
  range: RangeValue;
  onRangeChange: (range: RangeValue) => void;
  format: ReportFormat;
  onFormatChange: (format: ReportFormat) => void;
  branches: { id: string; name: string }[];
  /** "Branch", or "Account" for an owner login; and the All option's words. */
  siteLabel: string;
  allLabel: string;
  branchId: string;
  onBranchChange: (branchId: string) => void;
  sensors: SensorShape[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleSensor: (id: string) => void;
  /** Called with the instant the button was pressed: the report's clock. */
  onGenerate: (now: number) => void;
  generating: boolean;
}

const FORMAT_ICONS: Record<ReportFormat, SegmentedOption<ReportFormat>["icon"]> = {
  pdf: FileText,
  csv: Table,
};

const FORMAT_OPTIONS: SegmentedOption<ReportFormat>[] = FORMATS.map((f) => ({
  ...f,
  icon: FORMAT_ICONS[f.value],
}));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

export function ReportSettingsCard({
  range,
  onRangeChange,
  format,
  onFormatChange,
  branches,
  siteLabel,
  allLabel,
  branchId,
  onBranchChange,
  sensors,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleSensor,
  onGenerate,
  generating,
}: ReportSettingsCardProps) {
  const nothingSelected = selectedIds.size === 0;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Period, sensors and format</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* All branches or one, chosen first because it decides which
            sensors are listed below. The field exists only once there is a
            choice, and offers the same options the dashboard filters with. */}
        {hasBranches(branches) && (
          <Field label={siteLabel}>
            <Select aria-label={siteLabel} value={branchId} onChange={(e) => onBranchChange(e.target.value)}>
              <option value={ALL_BRANCHES}>{allLabel}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Time range">
          <SegmentedControl
            aria-label="Time range"
            options={RANGES}
            value={range}
            onChange={onRangeChange}
          />
        </Field>

        <Field label="Sensors">
          <SensorPicker
            sensors={sensors}
            selectedIds={selectedIds}
            allSelected={allSelected}
            onToggleAll={onToggleAll}
            onToggleSensor={onToggleSensor}
            showBranch={branchId === ALL_BRANCHES}
          />
        </Field>

        <Field label="Format">
          <SegmentedControl
            aria-label="Format"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={onFormatChange}
          />
        </Field>

        <div className="space-y-2 border-t border-hairline pt-5">
          <Button block onClick={() => onGenerate(Date.now())} disabled={nothingSelected || generating}>
            <Download className="size-4" />
            {generating ? "Generating…" : "Generate report"}
          </Button>
          {nothingSelected && sensors.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Select at least one sensor to generate a report.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
