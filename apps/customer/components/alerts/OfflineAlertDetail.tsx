import { formatDateTimeLong, formatTemp, formatReadingTime } from "@/lib/temperature";

// An offline alert has no readings to plot — that is the whole incident. What is
// worth showing is the last few that did arrive, because the shape of a fridge
// just before its sensor went quiet is the first question anyone asks.

interface Props {
  sensorName: string;
  /** When readings stopped arriving. */
  since: string;
  isResolved: boolean;
  /** The last readings before the gap, oldest first. */
  lastReadings: { id: string; temperature: number; recordedAt: string }[];
  timezone: string;
}

export function OfflineAlertDetail({
  sensorName,
  since,
  isResolved,
  lastReadings,
  timezone,
}: Props) {
  return (
    <>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">{sensorName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          No readings
          {" · "}
          {formatDateTimeLong(since, timezone)}
          {isResolved && <> · Reporting again</>}
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-1 text-sm font-medium">
          {isResolved
            ? "This sensor stopped reporting and has since recovered."
            : "This sensor has stopped reporting."}
        </p>
        <p className="text-sm text-muted-foreground">
          A sensor goes quiet when its battery is flat, it has been moved out of
          range of the gateway, or the gateway itself is down. Temperatures are
          not being recorded for it in the meantime.
        </p>

        {lastReadings.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Last readings before it went quiet
            </p>
            <table className="w-full text-sm">
              <tbody>
                {lastReadings.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 text-muted-foreground">
                      {formatReadingTime(r.recordedAt, timezone)}
                    </td>
                    <td className="py-1.5 text-right font-mono">{formatTemp(r.temperature)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
