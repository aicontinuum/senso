'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Unlink } from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatAgo } from '@/lib/platform-status';
import { LinkGatewayForm } from '@/components/customers/LinkGatewayForm';
import type { Branch } from '@/types/branches';

// The customer's gateways, with the technician's jobs on them: link a new
// one by its EUI, move one to another branch, and unlink one that is being
// removed. Unlinking is a soft delete on the server that also retires every
// sensor on the gateway; their readings stay for the compliance record, and
// the confirmation says so. The Branch column exists only once the customer
// has a second branch.

export type GatewayRow = {
  id: string;
  name: string | null;
  branch_id: string;
  is_online: boolean;
  firmware_version: string | null;
  last_seen_at: string | null;
  mac_address: string | null;
};

type LinkedSensor = { gateway_id: string; name: string };

interface GatewaysSectionProps {
  customerId: string;
  branches: Branch[];
  gateways: GatewayRow[];
  /** Live sensors, so the unlink confirmation can name what goes with the gateway. */
  sensors: LinkedSensor[];
  now: number;
}

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-3';

function unlinkWarning(linked: LinkedSensor[]): string {
  if (linked.length === 0) return 'Unlink this gateway?';
  const names = linked.map(s => s.name).join(', ');
  return `Unlinking retires ${linked.length} sensor${linked.length > 1 ? 's' : ''} (${names}). Readings are kept.`;
}

export function GatewaysSection({ customerId, branches, gateways, sensors, now }: GatewaysSectionProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const multiBranch = branches.length > 1;

  async function moveGateway(gatewayId: string, branchId: string) {
    setError('');
    setBusyId(gatewayId);
    const result = await callApi(`/api/customers/${customerId}/gateways/${gatewayId}`, 'PATCH', { branchId });
    setBusyId(null);
    if (!result.ok) { setError(result.error); return; }
    router.refresh();
  }

  async function unlinkGateway(gatewayId: string) {
    setError('');
    setBusyId(gatewayId);
    const result = await callApi(`/api/customers/${customerId}/gateways/${gatewayId}`, 'DELETE');
    setBusyId(null);
    if (!result.ok) { setError(result.error); return; }
    setConfirmUnlinkId(null);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div className="flex items-baseline gap-2">
          <CardTitle>Gateways</CardTitle>
          <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{gateways.length}</span>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Link gateway
          </Button>
        )}
      </CardHeader>

      {adding && (
        <div className="border-b border-hairline px-5 py-4">
          <LinkGatewayForm customerId={customerId} branches={branches} onDone={() => { setAdding(false); router.refresh(); }} onCancel={() => setAdding(false)} />
        </div>
      )}

      {gateways.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No gateway linked yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Link one by its EUI with Link gateway, then register sensors against it.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Name</th>
                {multiBranch && <th className={TH}>Branch</th>}
                <th className={TH}>EUI</th>
                <th className={TH}>Firmware</th>
                <th className={`${TH} whitespace-nowrap`}>Last seen</th>
                <th className={TH}>Status</th>
                <th className={`${TH} relative`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {gateways.map(g => {
                const linked = sensors.filter(s => s.gateway_id === g.id);
                const busy = busyId === g.id;
                return (
                  <tr key={g.id}>
                    <td className={`${TD} whitespace-nowrap font-medium`}>{g.name ?? g.id}</td>
                    {multiBranch && (
                      <td className={TD}>
                        <Select aria-label={`Branch of ${g.name ?? g.id}`} value={g.branch_id} onChange={e => moveGateway(g.id, e.target.value)} disabled={busy} wrapperClassName="w-44">
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                      </td>
                    )}
                    <td className={`${TD} font-mono text-xs text-muted-foreground`}>{g.mac_address ?? '—'}</td>
                    <td className={`${TD} text-muted-foreground`}>{g.firmware_version ?? '—'}</td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatAgo(g.last_seen_at, now)}</td>
                    <td className={TD}>
                      <Badge variant={g.is_online ? 'ok' : 'offline'} dot>{g.is_online ? 'Online' : 'Offline'}</Badge>
                    </td>
                    <td className={`${TD} text-right`}>
                      {confirmUnlinkId === g.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="max-w-xs text-right text-xs text-muted-foreground">{unlinkWarning(linked)}</span>
                          <Button variant="danger" size="sm" onClick={() => unlinkGateway(g.id)} disabled={busy}>{busy ? 'Unlinking…' : 'Unlink'}</Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmUnlinkId(null)} disabled={busy}>Cancel</Button>
                        </span>
                      ) : (
                        <Button variant="ghost" size="icon" aria-label={`Unlink ${g.name ?? g.id}`} title="Unlink" className="hover:text-alert-text" onClick={() => setConfirmUnlinkId(g.id)}>
                          <Unlink className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert" className="px-5 pb-4 text-sm text-alert-text">{error}</p>}
    </Card>
  );
}
