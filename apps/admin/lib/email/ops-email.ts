// The one email the platform sends about itself.
//
// Goes to OPS_ALERT_EMAIL and nowhere else. It has no customer, no sensor, and
// no recipient list; it describes Senso's own infrastructure in Senso's own
// vocabulary. What a customer hears about an outage, if anything, is a human
// decision made after reading this.

import type { PlatformAssessment, PlatformLevel, PlatformStatusRow } from '@/lib/platform-status';
import { formatCheck } from '@/lib/platform-status';
import { plainTextEmailHtml } from './plain-text';

const HEADLINE: Record<PlatformLevel, string> = {
  down: 'Senso platform is DOWN',
  late: 'Senso platform is late',
  ok: 'Senso platform has recovered',
};

const WHAT_IT_MEANS: Record<PlatformLevel, string> = {
  down:
    'Readings are not reaching the database. Nothing is being recorded and no ' +
    'customer alerts will open or send until this is fixed. Customers have not ' +
    'been told; that is your call.',
  late:
    'Readings are arriving, but the alert job has not completed inside its ' +
    'window. Breaches are being recorded and are not yet being emailed.',
  ok:
    'Every part of the platform has been heard from inside its window. Anything ' +
    'that opened during the outage will be sent on the next run.',
};

export function opsEmailSubject(level: PlatformLevel): string {
  return HEADLINE[level];
}

export function opsEmailText(
  assessment: PlatformAssessment,
  row: PlatformStatusRow,
  previousLevel: PlatformLevel,
  now: number,
): string {
  const lines = [
    HEADLINE[assessment.level],
    '',
    // The reason names the stamp that tripped; a recovery has none to name.
    ...(assessment.reason ? [assessment.reason, ''] : []),
    WHAT_IT_MEANS[assessment.level],
    '',
    `Was: ${previousLevel}. Now: ${assessment.level}.`,
    '',
    'Stamps:',
    ...assessment.checks.map((c) => `  ${c.label.padEnd(22)} ${formatCheck(c, row, now)}${c.level === 'ok' ? '' : `  (${c.level})`}`),
    '',
    'Runbook: network-server/README.md, "Platform pulse".',
    'Dashboard: the VPS watchdog card on admin.sensoqa.com.',
  ];
  return lines.join('\n');
}

export function opsEmailHtml(text: string): string {
  return plainTextEmailHtml(text);
}
