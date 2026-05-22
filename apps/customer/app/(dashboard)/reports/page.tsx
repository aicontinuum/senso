"use client";
import { useState } from "react";
import {
  mockCustomer,
  mockSensors,
  mockAlertConfigs,
  mockReadings,
} from "@senso/mock-data";
import {
  isOutOfRange,
  formatTemp,
  formatThreshold,
  formatReadingTime,
} from "@/lib/temperature";

const MOCK_NOW = new Date("2025-05-21T17:00:00.000Z").getTime();

type RangeValue = "12h" | "24h";

const RANGES: { label: string; value: RangeValue; ms: number }[] = [
  { label: "Last 12 hours", value: "12h", ms: 12 * 3_600_000 },
  { label: "Last 24 hours", value: "24h", ms: 24 * 3_600_000 },
];

function fmtDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function periodLabel(rangeMs: number): string {
  return `${fmtDateTime(MOCK_NOW - rangeMs)} – ${fmtDateTime(MOCK_NOW)}`;
}

export default function ReportsPage() {
  const [range, setRange] = useState<RangeValue>("24h");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(mockSensors.map((s) => s.id))
  );
  const [generated, setGenerated] = useState(false);

  const allSelected = selectedIds.size === mockSensors.length;

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(mockSensors.map((s) => s.id))
    );
    setGenerated(false);
  }

  function toggleSensor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGenerated(false);
  }

  const rangeMs = RANGES.find((r) => r.value === range)!.ms;
  const cutoff = MOCK_NOW - rangeMs;

  const reportSensors = mockSensors
    .filter((s) => selectedIds.has(s.id))
    .map((s) => ({
      sensor: s,
      config: mockAlertConfigs.find((c) => c.sensorId === s.id),
      readings: mockReadings[s.id]
        .filter((r) => new Date(r.recordedAt).getTime() >= cutoff)
        .sort(
          (a, b) =>
            new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        ),
    }));

  return (
    <div>
      {/* Filter bar */}
      <div className="print:hidden mb-6 space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>

        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <p className="text-sm font-medium mb-2">Time range</p>
            <div className="flex gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    setRange(r.value);
                    setGenerated(false);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    range === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Sensors</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-primary"
                />
                <span className="font-medium">
                  {allSelected ? "Deselect all" : "Select all"}
                </span>
              </label>
              {mockSensors.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSensor(s.id)}
                    className="accent-primary"
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setGenerated(true)}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate report
        </button>
      </div>

      {/* Report output */}
      {generated && (
        <div className="print:fixed print:inset-0 print:z-50 print:bg-white print:p-8 print:overflow-auto">
          {/* Screen-only action bar */}
          <div className="print:hidden flex items-center justify-between mb-4 pb-2 border-b border-border">
            <p className="text-sm text-muted-foreground">
              {reportSensors.length} sensor{reportSensors.length !== 1 ? "s" : ""}{" "}
              · {RANGES.find((r) => r.value === range)!.label}
            </p>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
            >
              Print / Export
            </button>
          </div>

          {reportSensors.map(({ sensor, config, readings }, i) => (
            <div
              key={sensor.id}
              className={`mb-10 ${i > 0 ? "break-before-page" : ""}`}
            >
              {/* Per-page header — repeats on every printed page */}
              <div className="mb-3">
                <h2 className="text-xl font-bold">Monitoring Report</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {mockCustomer.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Period: {periodLabel(rangeMs)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Generated: {fmtDateTime(MOCK_NOW)}
                </p>
              </div>

              <hr className="mb-4 border-border" />

              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-base font-semibold">{sensor.name}</h3>
                {config && (
                  <span className="text-sm text-muted-foreground">
                    Threshold: {formatThreshold(config.minTemp, config.maxTemp)}
                  </span>
                )}
              </div>

              {readings.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No readings in this period
                </p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-6 font-medium text-muted-foreground">
                        Date / Time
                      </th>
                      <th className="text-left py-2 pr-6 font-medium text-muted-foreground">
                        Temperature
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => {
                      const out = config
                        ? isOutOfRange(r.temperature, config.minTemp, config.maxTemp)
                        : false;
                      return (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-1.5 pr-6 text-muted-foreground">
                            {formatReadingTime(r.recordedAt)}
                          </td>
                          <td className="py-1.5 pr-6 font-mono">
                            {formatTemp(r.temperature)}
                          </td>
                          <td
                            className={`py-1.5 font-medium ${
                              out ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {out ? "✗ Out of range" : "✓ OK"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
