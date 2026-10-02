'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatAgo } from '@/lib/platform-status';
import { READING_RATE_WINDOW_DAYS, SENSOR_REPORTING_INTERVAL_MIN } from '@/lib/constants';
import { InlinePanel } from '@/components/billing/InlinePanel';
import type { NetworkDeviceRow } from '@/lib/network/load';

// One kind of device the network server knows, with what our records say
// about each row. Gateways and sensors are separate cards because they
// answer different questions: a gateway is up or not and at which site;
// a sensor also has how complete its record has been lately, where a
// slip from 100 to 90 is a radio or battery problem worth a visit before
// it fails hard. Two forms of the same rows: a table from desktop width
// up, a stacked list below it. Removing an unlinked device opens the one
// confirmation shape under the row; a linked device is removed from its
// customer's page, never here. A sensor row can also resend its
// reporting interval.

type Kind = NetworkDeviceRow['kind'];
type Props = { kind: Kind; rows: NetworkDeviceRow[]; now: number };

/** Below this share received live, the figure turns red: worth a visit. */
const RATE_WARN_BELOW = 95;

const WORDS: Record<Kind, { title: string; empty: string; apiPath: string }> = {
  gateway: { title: 'Gateways', empty: 'No gateways registered yet.', apiPath: 'gateways' },
  sensor: { title: 'Sensors', empty: 'No sensors registered yet.', apiPath: 'sensors' },
};

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-3';
const PANEL = 'border-t border-hairline bg-sunken px-5 py-4';

type Message = { eui: string; text: string; tone: 'ok' | 'error' };

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function LastHeard({ row, now }: { row: NetworkDeviceRow; now: number }) {
  return row.lastSeenAt ? <>{formatAgo(row.lastSeenAt, now)}</> : <Badge variant="warn" dot>Never</Badge>;
}

// Unlinked is the normal state of hardware just registered, not a fault,
// so it is an outlined chip: grey with a dot is kept for what is quiet.
function LinkedTo({ row }: { row: NetworkDeviceRow }) {
  if (!row.link) return <Badge variant="outline" className="text-muted-foreground">Not linked</Badge>;
  return (
    <Link href={`/customers/${row.link.customerId}`} className="font-medium hover:underline">
      {row.link.customerName}{row.link.branchName ? ` · ${row.link.branchName}` : ''}
    </Link>
  );
}

function Rate({ row }: { row: NetworkDeviceRow }) {
  if (!row.rate) return <Dash />;
  return (
    <span className={row.rate.percent < RATE_WARN_BELOW ? 'font-medium text-alert-text' : ''} title={`${row.rate.expected} expected over ${READING_RATE_WINDOW_DAYS} days`}>
      <span className="tabular-nums">{row.rate.percent}%</span>
      {row.rate.recovered > 0 && <span className="text-muted-foreground"> · {row.rate.recovered} recovered</span>}
    </span>
  );
}

export function NetworkDevicesCard({ kind, rows, now }: Props) {
  const router = useRouter();
  const words = WORDS[kind];
  const isSensor = kind === 'sensor';
  const [confirmEui, setConfirmEui] = useState<string | null>(null);
  const [busyEui, setBusyEui] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  async function act(row: NetworkDeviceRow, method: 'DELETE' | 'POST', path: string, done: string) {
    setMessage(null);
    setBusyEui(row.eui);
    const result = await callApi(path, method);
    setBusyEui(null);
    if (!result.ok) { setMessage({ eui: row.eui, text: result.error, tone: 'error' }); return; }
    setConfirmEui(null);
    setMessage({ eui: row.eui, text: done, tone: 'ok' });
    router.refresh();
  }

  const remove = (row: NetworkDeviceRow) =>
    act(row, 'DELETE', `/api/network/${words.apiPath}/${row.eui}`, 'Removed from the network server.');
  const resend = (row: NetworkDeviceRow) =>
    act(row, 'POST', `/api/network/sensors/${row.eui}/interval`, `Interval queued; it takes effect after the sensor's next uplink.`);

  // The icon buttons, the same in both forms. The remove confirmation
  // and any outcome are drawn under the row, never squeezed in beside.
  const actions = (row: NetworkDeviceRow) => {
    const busy = busyEui === row.eui;
    return (
      <span className="flex shrink-0 items-center justify-end gap-1">
        {isSensor && (
          <Button variant="ghost" size="icon" aria-label={`Resend ${SENSOR_REPORTING_INTERVAL_MIN}-minute interval to ${row.name || row.eui}`} title={`Resend ${SENSOR_REPORTING_INTERVAL_MIN}-minute interval`} onClick={() => { setMessage(null); resend(row); }} disabled={busy}>
            <RefreshCw className="size-4" />
          </Button>
        )}
        {!row.link && (
          <Button variant="ghost" size="icon" aria-label={`Remove ${row.name || row.eui} from the network server`} title="Remove from the network server" className="hover:text-alert-text" onClick={() => { setMessage(null); setConfirmEui(row.eui); }} disabled={busy || confirmEui === row.eui}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </span>
    );
  };

  // What sits under a row: the remove confirmation, or the last outcome.
  const underRow = (row: NetworkDeviceRow) => {
    if (confirmEui === row.eui) {
      return (
        <div className={PANEL}>
          <InlinePanel
            title={`Remove ${row.name || row.eui} from the network server?`}
            description={isSensor
              ? 'It stops being able to join. Nothing in our records changes; it can be registered again with its key.'
              : 'It stops being able to relay. Nothing in our records changes; it can be registered again.'}
            error={message?.eui === row.eui && message.tone === 'error' ? message.text : undefined}
            confirmLabel="Remove"
            busyLabel="Removing…"
            busy={busyEui === row.eui}
            danger
            onConfirm={() => remove(row)}
            onCancel={() => { setConfirmEui(null); setMessage(null); }}
          />
        </div>
      );
    }
    if (message?.eui === row.eui) {
      return (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`${PANEL} text-sm ${message.tone === 'error' ? 'text-alert-text' : 'text-muted-foreground'}`}>
          {message.text}
        </p>
      );
    }
    return null;
  };

  const columns = isSensor ? 6 : 5;

  return (
    <Card asChild className="overflow-hidden">
      <section aria-label={words.title}>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
          <div className="flex items-baseline gap-2">
            <CardTitle>{words.title}</CardTitle>
            <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{rows.length}</span>
          </div>
        </CardHeader>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">{words.empty}</p>
        ) : (
          <>
            {/* Desktop: the table. */}
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="border-b border-hairline text-left text-muted-foreground">
                  <th className={TH}>Name</th>
                  <th className={TH}>EUI</th>
                  <th className={`${TH} whitespace-nowrap`}>Last heard</th>
                  <th className={TH}>Linked to</th>
                  {isSensor && <th className={`${TH} whitespace-nowrap`}>Readings, {READING_RATE_WINDOW_DAYS} days</th>}
                  <th className={`${TH} relative`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map(row => {
                  const under = underRow(row);
                  return (
                    <Fragment key={row.eui}>
                      <tr>
                        <td className={`${TD} whitespace-nowrap font-mono font-medium`}>{row.name || <Dash />}</td>
                        <td className={`${TD} font-mono text-xs text-muted-foreground`}>{row.eui}</td>
                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}><LastHeard row={row} now={now} /></td>
                        <td className={`${TD} whitespace-nowrap`}><LinkedTo row={row} /></td>
                        {isSensor && <td className={`${TD} whitespace-nowrap`}><Rate row={row} /></td>}
                        <td className={`${TD} text-right`}>{actions(row)}</td>
                      </tr>
                      {under && (
                        <tr className="border-t-0">
                          <td colSpan={columns} className="p-0">{under}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Phone: the same rows as a list. Name, then the EUI and what it
                is linked to; on the right when it was heard and, for a
                sensor, its readings rate. */}
            <ul className="divide-y divide-hairline lg:hidden">
              {rows.map(row => (
                <li key={row.eui}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium">{row.name || row.eui}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.eui}</p>
                      {/* Divs, not paragraphs: a badge is a block and may not sit in a p. */}
                      <div className="mt-1 text-xs text-muted-foreground"><LinkedTo row={row} /></div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 text-right text-xs text-muted-foreground">
                      <LastHeard row={row} now={now} />
                      {row.rate && <Rate row={row} />}
                    </div>
                    {actions(row)}
                  </div>
                  {underRow(row)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Card>
  );
}
