import Link from 'next/link';
import { Badge, Card } from '@senso/ui';
import { LinkRow } from '@/components/ui/link-row';
import { formatAgo } from '@/lib/platform-status';

// One row per customer: is their site up, are their sensors reporting, and
// have they had alerts today. Rows arrive already sorted with the customers
// that need attention first; this component only draws them.

export type FleetGateway = {
  id: string;
  online: boolean;
  lastSeenAt: string | null;
};

export type FleetRow = {
  id: string;
  name: string;
  email: string;
  gateways: FleetGateway[];
  sensorsOnline: number;
  sensorsOffline: number;
  sensorsPending: number;
  alertCount: number;
};

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-4';

function Count({ value, tone, label }: { value: number; tone: string; label: string }) {
  return (
    <span>
      <span className={`font-medium ${value > 0 ? tone : ''}`}>{value}</span> {label}
    </span>
  );
}

export function CustomerFleetTable({ rows, now }: { rows: FleetRow[]; now: number }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-muted-foreground">
            <th className={TH}>Customer</th>
            <th className={TH}>Gateway</th>
            <th className={TH}>Sensors</th>
            <th className={TH}>Alerts (past 24h)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.length === 0 && (
            <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No customers yet.</td></tr>
          )}
          {rows.map((row) => {
            const href = `/customers/${row.id}`;
            const sensorTotal = row.sensorsOnline + row.sensorsOffline + row.sensorsPending;
            return (
              <LinkRow key={row.id} href={href}>
                <td className={TD}>
                  <Link href={href} className="font-medium hover:underline">{row.name}</Link>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </td>
                <td className={TD}>
                  {row.gateways.length > 0 ? (
                    <div className="space-y-1.5">
                      {row.gateways.map((g) => (
                        <div key={g.id} className="flex flex-wrap items-center gap-2">
                          <Badge variant={g.online ? 'ok' : 'alert'} dot>
                            {g.online ? 'Online' : 'Offline'}
                          </Badge>
                          {/* How long a site has been dark is the first thing
                              anyone asks, so it sits next to the word. */}
                          {!g.online && (
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              last seen {formatAgo(g.lastSeenAt, now)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {sensorTotal === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="space-x-1.5 text-muted-foreground">
                      <Count value={row.sensorsOnline} tone="text-ok-text" label="online" />
                      {row.sensorsOffline > 0 && (
                        <><span>·</span> <Count value={row.sensorsOffline} tone="text-alert-text" label="offline" /></>
                      )}
                      {row.sensorsPending > 0 && (
                        <><span>·</span> <Count value={row.sensorsPending} tone="text-warn-text" label="pending" /></>
                      )}
                    </span>
                  )}
                </td>
                <td className={`${TD} tabular-nums`}>
                  {row.alertCount > 0
                    ? <span className="font-medium text-alert-text">{row.alertCount}</span>
                    : <span className="text-muted-foreground">0</span>}
                </td>
              </LinkRow>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
