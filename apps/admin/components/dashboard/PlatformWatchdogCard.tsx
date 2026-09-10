import { ChevronDown } from 'lucide-react';
import { Card, StatusDot, type StatusTone } from '@senso/ui';
import { assessPlatform, formatCheck, type PlatformLevel, type PlatformStatusRow } from '@/lib/platform-status';

// The first tile on the admin dashboard: is Senso's own infrastructure alive?
//
// Every other number on the page assumes readings can reach the database. This
// card says whether that assumption holds right now, from the platform's own
// stamps rather than from what the fleet happens to look like. Staff only; it is
// never shown to a customer and nothing here reaches their inbox.
//
// It takes up space in proportion to what it has to say. Healthy, it is one
// line with the six checks folded away behind a disclosure; Late or Down, it
// opens itself so the failing check is on screen without a tap. A native
// <details> does this with no client state, and the open attribute is set at
// render, so a page refresh always lands in the right posture for the moment.

const TONE: Record<PlatformLevel, { dot: StatusTone; text: string; label: string }> = {
  ok:   { dot: 'ok',    text: 'text-ok-text',    label: 'Healthy' },
  late: { dot: 'warn',  text: 'text-warn-text',  label: 'Late' },
  down: { dot: 'alert', text: 'text-alert-text', label: 'Down' },
};

const HEALTHY_REASON = 'Every part of the platform has been heard from inside its window.';

export function PlatformWatchdogCard({ status, now }: { status: PlatformStatusRow | null; now: number }) {
  const { level, checks, reason } = assessPlatform(status, now);
  const tone = TONE[level];
  const healthy = level === 'ok';

  return (
    <Card className={`overflow-hidden ${level === 'down' ? 'border-alert-border' : ''}`}>
    <details open={!healthy} aria-label="VPS watchdog" className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-sunken sm:px-6 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5">
          <StatusDot status={tone.dot} className="size-2.5" />
          <h2 className="text-sm font-semibold tracking-tight">VPS watchdog</h2>
          <span className={`text-sm font-medium ${tone.text}`}>{tone.label}</span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <p className="text-sm text-muted-foreground">{reason ?? HEALTHY_REASON}</p>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </div>
      </summary>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline px-4 py-4 text-sm sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
        {checks.map((check) => {
          const checkTone = TONE[check.level];
          const flagged = check.level !== 'ok';
          return (
            <div key={check.label}>
              <dt className="text-xs font-medium text-muted-foreground">{check.label}</dt>
              <dd className={`mt-0.5 flex items-center gap-1.5 tabular-nums ${flagged ? `font-medium ${checkTone.text}` : ''}`}>
                {flagged && <StatusDot status={checkTone.dot} />}
                {formatCheck(check, status, now)}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
    </Card>
  );
}
