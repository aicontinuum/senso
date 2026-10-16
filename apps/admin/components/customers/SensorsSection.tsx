'use client';

import { Fragment, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { batteryTier, networkName } from '@senso/status';
import { Badge, BatteryMeter, Button, Card, CardHeader, CardTitle, InlinePanel, Input, Select, useDismiss } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { AvailableDevices } from '@/lib/network/available';

// The customer's sensors, with the technician's two jobs on them: add one
// against a gateway, and retire one that is being removed. A sensor is
// chosen from those registered on the network server and not yet linked
// to anyone, never typed, so it always exists before it is linked. Retiring
// is a soft delete on the server; the readings stay for the compliance
// record.

export type SensorRow = {
  id: string;
  name: string;
  status: string;
  /** Voltage on the latest reading; null until the sensor has reported. */
  battery_v: number | null;
  gateway_id: string;
  /** Null until a technician marks the sensor installed. */
  commissioned_at: string | null;
  /** The DevEUI; its tail is the sensor ID the office and the customer read. */
  hardware_id: string | null;
};

type GatewayOption = { id: string; name: string | null };

interface SensorsSectionProps {
  customerId: string;
  gateways: GatewayOption[];
  sensors: SensorRow[];
  /** Registered on the network server, linked to no one: the choices for Add sensor. */
  available: AvailableDevices;
}

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-3';
const COLUMNS = 6;
const PANEL = 'border-t border-hairline bg-sunken px-5 py-4';

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

export function SensorsSection({ customerId, gateways, sensors, available }: SensorsSectionProps) {
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(() => emptyForm(gateways));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const setField = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // The open retire panel; a click anywhere else is a Cancel, closing only
  // that panel so a click on another row's bin still opens its own.
  const confirmRow = useRef<HTMLTableRowElement | null>(null);
  useDismiss(confirmRow, confirmRemoveId !== null && !removing, () =>
    setConfirmRemoveId(open => (open === confirmRemoveId ? null : open)),
  );

  function openRemove(id: string) {
    setRemoveError(null);
    setConfirmRemoveId(id);
  }

  async function addSensor() {
    setFormError('');
    const devEui = form.hardwareId;
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

  // The panel stays open with the error if retiring fails, so it is read
  // where the decision was made.
  async function removeSensor(sensorId: string) {
    setRemoveError(null);
    setRemoving(true);
    const result = await callApi(`/api/customers/${customerId}/sensors/${sensorId}`, 'DELETE');
    setRemoving(false);
    if (!result.ok) { setRemoveError(result.error); return; }
    setConfirmRemoveId(null);
    router.refresh();
  }

  const canSubmit = !saving && form.gatewayId !== '' && form.name.trim() !== '' && form.hardwareId.trim() !== '';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div className="flex items-baseline gap-2">
          <CardTitle>Sensors</CardTitle>
          <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{sensors.length}</span>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => { setForm(emptyForm(gateways)); setAdding(true); }}>
            <Plus className="size-4" />
            Add sensor
          </Button>
        )}
      </CardHeader>

      {/* The form opens where the click landed, under the header, rather than
          below a table that may be long. */}
      {adding && (
        <div className="border-b border-hairline px-5 py-4">
          <Card tone="sunken" className="space-y-4 p-4 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
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

            {available.state === 'unavailable' ? (
              <p className="text-sm text-alert-text">The network server did not answer, so the registered sensors cannot be listed. Try again in a minute.</p>
            ) : available.sensors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No registered sensor is waiting. Register one on the Devices page first.</p>
            ) : (
              <Select
                label="Sensor"
                hint="Registered on the network server and not yet linked to a customer."
                value={form.hardwareId}
                onChange={e => setField('hardwareId')(e.target.value)}
                error={formError || undefined}
              >
                <option value="">Choose a sensor</option>
                {available.sensors.map(s => (
                  <option key={s.eui} value={s.eui}>{s.name ? `${s.name} · ${s.eui}` : s.eui}</option>
                ))}
              </Select>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={addSensor} disabled={!canSubmit}>
                {saving ? 'Adding…' : 'Add sensor'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setAdding(false); setFormError(''); }}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {sensors.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No sensors yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Register one against a gateway with Add sensor.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Name</th>
                <th className={`${TH} whitespace-nowrap`}>Sensor ID</th>
                <th className={TH}>Gateway</th>
                <th className={TH}>Status</th>
                <th className={TH}>Battery</th>
                <th className={`${TH} relative`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {sensors.map(s => (
                <Fragment key={s.id}>
                <tr>
                  <td className={`${TD} whitespace-nowrap font-medium`}>{s.name}</td>
                  <td className={`${TD} font-mono text-xs text-muted-foreground`}>{s.hardware_id ? networkName('sensor', s.hardware_id) : '—'}</td>
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
                    <span className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label={`Settings for ${s.name}`} title="Settings">
                        <Link href={`/customers/${customerId}/sensors/${s.id}`}>
                          <Settings className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Retire ${s.name}`}
                        title="Retire"
                        className="hover:text-alert-text"
                        onClick={() => openRemove(s.id)}
                        disabled={confirmRemoveId === s.id}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </td>
                </tr>
                {/* The "are you sure" step opens under the row, the shape every
                    confirmation takes, rather than squeezing into the row. */}
                {confirmRemoveId === s.id && (
                  <tr ref={confirmRow} className="border-t-0">
                    <td colSpan={COLUMNS} className="p-0">
                      <div className={PANEL}>
                        <InlinePanel
                          title={`Retire ${s.name}?`}
                          description="It leaves the customer's live devices. Its readings stay on record for compliance."
                          error={removeError ?? undefined}
                          confirmLabel="Retire"
                          busyLabel="Retiring…"
                          busy={removing}
                          danger
                          onConfirm={() => removeSensor(s.id)}
                          onCancel={() => setConfirmRemoveId(null)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </Card>
  );
}
