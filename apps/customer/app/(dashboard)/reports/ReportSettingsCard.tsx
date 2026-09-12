import { Download, FileText, Table } from "lucide-react";
import { Button } from "@senso/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@senso/ui";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { SensorPicker } from "./SensorPicker";
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
  sensors: SensorShape[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleSensor: (id: string) => void;
  onGenerate: () => void;
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
          <Button block onClick={onGenerate} disabled={nothingSelected || generating}>
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
