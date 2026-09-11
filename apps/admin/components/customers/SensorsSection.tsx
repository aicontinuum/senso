'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { batteryTier } from '@senso/status';
import { Badge, BatteryMeter, Button, Card, CardHeader, CardTitle, Input, Select } from '@senso/ui';
import { normaliseDevEui, isValidDevEui } from '@/lib/deveui';

// The customer's sensors, with the technician's two jobs on them: register a
// new one against a gateway, and retire one that is being removed. Retiring is
// a soft delete on the server; the readings stay for the compliance record.

export type SensorRow = {
  id: string;
  name: string;
  status: string;
  /** Voltage on the latest reading; null until the sensor has reported. */
  battery_v: number | null;
  gateway_id: string;
  /** Null until a technician marks the sensor installed. */
  commissioned_at: string | null;
};

type GatewayOption = { id: string; name: string | null };

interface SensorsSectionProps {
  customerId: string;
  gateways: GatewayOption[];
  sensors: SensorRow[];
}

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-3';

function emptyForm(gateways: GatewayOption[]) {
  return { gatewayId: gateways[0]?.id ?? '', name: '', hardwareId: '' };
}

function SensorStatus({ sensor }: { sensor: SensorRow }) {
  // Not commissioned outranks online/offline: the sensor may be reporting
  // perfectly and still not be monitoring anything the customer owns.
  if (sensor.commissioned_at === null) return <Badge variant="warn" dot>Not in service</Badge>;
  if (sensor.status === 'online') return <Badge variant="ok" dot>Online</Badge>;
  return <Badge variant="offline" dot>Offline</Badge>;
}

export function SensorsSection({ customerId, gateways, sensors }: SensorsSectionProps) {
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(() => emptyForm(gateways));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const setField = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  async function addSensor() {
    setFormError('');
    // Normalise here as well as server-side, so a DevEUI pasted from a label or
    // QR with colons or dashes is accepted rather than bounced back.
    const devEui = normaliseDevEui(form.hardwareId);
    if (!isValidDevEui(devEui)) {
      setFormError('Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, hardwareId: devEui }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Failed to add sensor');
        return;
      }
      setAdding(false);
      setForm(emptyForm(gateways));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeSensor(sensorId: string) {
    setRemoving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/sensors/${sensorId}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmRemoveId(null);
        router.refresh();
      }
    } finally {
      setRemoving(false);
    }
  }

  const canSubmit = !saving && form.gatewayId !== '' && form.name.trim() !== '' && form.hardwareId.trim() !== '';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-baseline gap-2 space-y-0 border-b border-hairline">
        <CardTitle>Sensors</CardTitle>
        <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{sensors.length}</span>
      </CardHeader>

      {sensors.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No sensors yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Register one against a gateway below.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Name</th>
                <th className={TH}>Gateway</th>
                <th className={TH}>Status</th>
                <th className={TH}>Battery</th>
                <th className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {sensors.map(s => (
                <tr key={s.id}>
                  <td className={`${TD} font-medium`}>{s.name}</td>
                  <td className={`${TD} text-muted-foreground`}>
                    {gateways.find(g => g.id === s.gateway_id)?.name ?? '—'}
                  </td>
                  <td className={TD}><SensorStatus sensor={s} /></td>
                  <td className={TD}>
                    {batteryTier(s.battery_v)
                      ? <BatteryMeter volts={s.battery_v} />
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={`${TD} text-right`}>
                    {confirmRemoveId === s.id ? (
                      // The "are you sure" step, inline where the click landed.
                      <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">Retire this sensor?</span>
                        <Button variant="danger" size="sm" onClick={() => removeSensor(s.id)} disabled={removing}>
                          {removing ? 'Retiring…' : 'Retire'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)} disabled={removing}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label={`Settings for ${s.name}`} title="Settings">
                          <Link href={`/customers/${customerId}/sensors/${s.id}`}>
                            <Settings className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${s.name}`}
                          title="Remove"
                          className="hover:text-alert-text"
                          onClick={() => setConfirmRemoveId(s.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-hairline px-5 py-4">
        {!adding ? (
          <Button size="sm" onClick={() => { setForm(emptyForm(gateways)); setAdding(true); }}>
            <Plus className="size-4" />
            Add sensor
          </Button>
        ) : (
          <Card tone="sunken" className="space-y-4 p-4">
            <p className="text-sm font-semibold">New sensor</p>

            {gateways.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gateways linked — add a gateway first.</p>
            ) : (
              <Select label="Gateway" value={form.gatewayId} onChange={e => setField('gatewayId')(e.target.value)}>
                {gateways.map(g => (
                  <option key={g.id} value={g.id}>{g.name ?? g.id}</option>
                ))}
              </Select>
            )}

            <Input
              label="Sensor name"
              value={form.name}
              onChange={e => setField('name')(e.target.value)}
              placeholder="e.g. Cold Storage A"
            />

            <Input
              label="DevEUI"
              hint="From the sensor label or QR code."
              value={form.hardwareId}
              onChange={e => setField('hardwareId')(e.target.value)}
              placeholder="a840419edb62011c"
              className="font-mono"
              error={formError || undefined}
            />

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={addSensor} disabled={!canSubmit}>
                {saving ? 'Adding…' : 'Add sensor'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setAdding(false); setFormError(''); }}>
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
}
