'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatAgo } from '@/lib/platform-status';
import { SENSOR_REPORTING_INTERVAL_MIN } from '@/lib/constants';
import type { NetworkDeviceRow } from '@/lib/network/load';

// Everything the network server knows, with what our records say about
// each row. Two actions: remove an unlinked device from the network, and
// resend a sensor's reporting interval. A linked device is removed from
// its customer's page, never here.

type Props = { rows: NetworkDeviceRow[]; now: number };

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-3';

export function NetworkDevicesTable({ rows, now }: Props) {
  const router = useRouter();
  const [confirmEui, setConfirmEui] = useState<string | null>(null);
  const [busyEui, setBusyEui] = useState<string | null>(null);
  const [message, setMessage] = useState<{ eui: string; text: string; tone: 'ok' | 'error' } | null>(null);

  async function act(row: NetworkDeviceRow, method: 'DELETE' | 'POST', path: string, done: string) {
    setMessage(null);
    setBusyEui(row.eui);
    const result = await callApi(path, method);
    setBusyEui(null);
    setConfirmEui(null);
    if (!result.ok) { setMessage({ eui: row.eui, text: result.error, tone: 'error' }); return; }
    setMessage({ eui: row.eui, text: done, tone: 'ok' });
    router.refresh();
  }

  const remove = (row: NetworkDeviceRow) =>
    act(row, 'DELETE', `/api/network/${row.kind === 'gateway' ? 'gateways' : 'sensors'}/${row.eui}`, 'Removed from the network server.');
  const resend = (row: NetworkDeviceRow) =>
    act(row, 'POST', `/api/network/sensors/${row.eui}/interval`, `Interval queued; it takes effect after the sensor's next uplink.`);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div className="flex items-baseline gap-2">
          <CardTitle>On the network server</CardTitle>
          <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{rows.length}</span>
        </div>
      </CardHeader>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Nothing registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Kind</th>
                <th className={TH}>Name</th>
                <th className={TH}>EUI</th>
                <th className={`${TH} whitespace-nowrap`}>Last heard</th>
                <th className={TH}>Linked to</th>
                <th className={`${TH} relative`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map(row => {
                const busy = busyEui === row.eui;
                return (
                  <tr key={row.eui}>
                    <td className={`${TD} capitalize text-muted-foreground`}>{row.kind}</td>
                    <td className={`${TD} whitespace-nowrap font-medium`}>{row.name || '—'}</td>
                    <td className={`${TD} font-mono text-xs text-muted-foreground`}>{row.eui}</td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                      {row.lastSeenAt ? formatAgo(row.lastSeenAt, now) : <Badge variant="warn" dot>Never</Badge>}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {row.link ? (
                        <Link href={`/customers/${row.link.customerId}`} className="font-medium hover:underline">
                          {row.link.customerName}{row.link.branchName ? ` · ${row.link.branchName}` : ''}
                        </Link>
                      ) : (
                        <Badge variant="offline" dot>Not linked</Badge>
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      <span className="flex items-center justify-end gap-2">
                        {message?.eui === row.eui && (
                          <span className={`max-w-xs text-right text-xs ${message.tone === 'error' ? 'text-alert-text' : 'text-muted-foreground'}`}>{message.text}</span>
                        )}
                        {row.kind === 'sensor' && confirmEui !== row.eui && (
                          <Button variant="ghost" size="icon" aria-label={`Resend ${SENSOR_REPORTING_INTERVAL_MIN}-minute interval to ${row.name || row.eui}`} title={`Resend ${SENSOR_REPORTING_INTERVAL_MIN}-minute interval`} onClick={() => resend(row)} disabled={busy}>
                            <RefreshCw className="size-4" />
                          </Button>
                        )}
                        {!row.link && (confirmEui === row.eui ? (
                          <>
                            <span className="text-xs text-muted-foreground">Remove from the network server?</span>
                            <Button variant="danger" size="sm" onClick={() => remove(row)} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmEui(null)} disabled={busy}>Cancel</Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label={`Remove ${row.name || row.eui} from the network server`} title="Remove from the network server" className="hover:text-alert-text" onClick={() => setConfirmEui(row.eui)} disabled={busy}>
                            <Trash2 className="size-4" />
                          </Button>
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
