'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Unlink } from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle, Input } from '@senso/ui';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';
import { formatAgo } from '@/lib/platform-status';

// The customer's gateways, with the technician's two jobs on them: link a new
// one by its EUI, and unlink one that is being removed. Unlinking is a soft
// delete on the server that also retires every sensor on the gateway; their
// readings stay for the compliance record, and the confirmation says so.

export type GatewayRow = {
  id: string;
  name: string | null;
  is_online: boolean;
  firmware_version: string | null;
  last_seen_at: string | null;
  mac_address: string | null;
};

type LinkedSensor = { gateway_id: string; name: string };

interface GatewaysSectionProps {
  customerId: string;
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

export function GatewaysSection({ customerId, gateways, sensors, now }: GatewaysSectionProps) {
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [eui, setEui] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [linking, setLinking] = useState(false);

  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  function resetForm() {
    setEui('');
    setName('');
    setFormError('');
  }

  async function linkGateway() {
    setFormError('');
    const normalised = normaliseIdentifier(eui);
    if (!isValidGatewayId(normalised)) {
      setFormError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
      return;
    }
    if (!name.trim()) {
      setFormError('Gateway name is required');
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/gateways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: normalised, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Failed to link gateway');
        return;
      }
      resetForm();
      setAdding(false);
      router.refresh();
    } finally {
      setLinking(false);
    }
  }

  async function unlinkGateway(gatewayId: string) {
    setUnlinking(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/gateways/${gatewayId}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmUnlinkId(null);
        router.refresh();
      }
    } finally {
      setUnlinking(false);
    }
  }

  const canSubmit = !linking && eui.trim() !== '' && name.trim() !== '';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-baseline gap-2 space-y-0 border-b border-hairline">
        <CardTitle>Gateways</CardTitle>
        <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{gateways.length}</span>
      </CardHeader>

      {gateways.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No gateway linked yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Link one by its EUI below, then register sensors against it.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Name</th>
                <th className={TH}>EUI</th>
                <th className={TH}>Firmware</th>
                <th className={`${TH} whitespace-nowrap`}>Last seen</th>
                <th className={TH}>Status</th>
                <th className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {gateways.map(g => {
                const linked = sensors.filter(s => s.gateway_id === g.id);
                return (
                  <tr key={g.id}>
                    <td className={`${TD} font-medium`}>{g.name ?? g.id}</td>
                    <td className={`${TD} font-mono text-xs text-muted-foreground`}>{g.mac_address ?? '—'}</td>
                    <td className={`${TD} text-muted-foreground`}>{g.firmware_version ?? '—'}</td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatAgo(g.last_seen_at, now)}</td>
                    <td className={TD}>
                      <Badge variant={g.is_online ? 'ok' : 'offline'} dot>
                        {g.is_online ? 'Online' : 'Offline'}
                      </Badge>
                    </td>
                    <td className={`${TD} text-right`}>
                      {confirmUnlinkId === g.id ? (
                        // The "are you sure" step, inline where the click landed,
                        // naming the sensors that go with the gateway.
                        <span className="flex items-center justify-end gap-2">
                          <span className="max-w-xs text-right text-xs text-muted-foreground">{unlinkWarning(linked)}</span>
                          <Button variant="danger" size="sm" onClick={() => unlinkGateway(g.id)} disabled={unlinking}>
                            {unlinking ? 'Unlinking…' : 'Unlink'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmUnlinkId(null)} disabled={unlinking}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Unlink ${g.name ?? g.id}`}
                          title="Unlink"
                          className="hover:text-alert-text"
                          onClick={() => setConfirmUnlinkId(g.id)}
                        >
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

      <div className="border-t border-hairline px-5 py-4">
        {!adding ? (
          <Button size="sm" onClick={() => { resetForm(); setAdding(true); }}>
            <Plus className="size-4" />
            Link gateway
          </Button>
        ) : (
          <Card tone="sunken" className="space-y-4 p-4">
            <p className="text-sm font-semibold">Link a gateway</p>

            <Input
              label="Gateway EUI"
              hint="From the label on the gateway."
              value={eui}
              onChange={e => { setEui(e.target.value); setFormError(''); }}
              onKeyDown={e => e.key === 'Enter' && linkGateway()}
              placeholder="2cf7f11081400088"
              className="font-mono"
              error={formError || undefined}
            />

            <Input
              label="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && linkGateway()}
              placeholder="e.g. Kitchen gateway"
            />

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={linkGateway} disabled={!canSubmit}>
                {linking ? 'Linking…' : 'Link gateway'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setAdding(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
}
