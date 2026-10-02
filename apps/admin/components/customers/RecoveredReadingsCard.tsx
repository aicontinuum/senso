import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@senso/ui';
import { formatAgo } from '@senso/status';

// The admin-side view of backfill: how much of this sensor's recent record
// was recovered from its memory rather than received live. The customer
// never sees the distinction; the office should, because a sensor that
// keeps needing recovery has a radio problem worth a visit.

type Props = {
  /** Backfilled readings in the window. */
  count: number;
  windowDays: number;
  /** The latest recovered reading's time, when there is one. */
  latestAt: string | null;
};

export function RecoveredReadingsCard({ count, windowDays, latestAt }: Props) {
  return (
    <Card>
      <CardHeader className="border-b border-hairline">
        <CardTitle>Recovered readings</CardTitle>
        <CardDescription>
          Readings this sensor sent from its memory after a gap, filed with the time it took them. The customer sees them as ordinary readings.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">None in the last {windowDays} days.</p>
        ) : (
          <p className="text-sm">
            <span className="font-display text-lg font-semibold tabular-nums">{count}</span>
            <span className="text-muted-foreground"> in the last {windowDays} days{latestAt ? `, latest ${formatAgo(latestAt)}` : ''}.</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
