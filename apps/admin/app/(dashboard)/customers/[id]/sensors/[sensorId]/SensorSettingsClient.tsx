'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Pencil } from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';

// One sensor as the office sees it: its name, which gateway it hangs off,
// and the thresholds that raise alerts, read as label and value pairs and
// edited in place behind one Edit, the same shape as the customer's
// Account info card. The DevEUI is shown and never edited: it is the
// device's identity.

interface SensorData {
  id: string;
  name: string;
  status: string;
  gatewayId: string;
  hardwareId: string;
  minTemp: number;
  maxTemp: number;
}

interface GatewayOption {
  id: string;
  name: string;
}

interface Props {
  customerId: string;
  sensor: SensorData;
  gateways: GatewayOption[];
}

const TEMP_UNIT = '°C';

function formOf(sensor: SensorData) {
  return {
    name: sensor.name,
    gatewayId: sensor.gatewayId,
    minTemp: String(sensor.minTemp),
    maxTemp: String(sensor.maxTemp),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:pt-2.5">{label}</dt>
      <dd className="text-sm sm:col-span-2">{children}</dd>
    </div>
  );
}

export function SensorSettingsClient({ customerId, sensor, gateways }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formOf(sensor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => { setForm(f => ({ ...f, [key]: value })); setError(''); };

  const gatewayName = gateways.find(g => g.id === sensor.gatewayId)?.name ?? sensor.gatewayId;
  const online = sensor.status === 'online';

  const changed =
    form.name !== sensor.name ||
    form.gatewayId !== sensor.gatewayId ||
    Number(form.minTemp) !== sensor.minTemp ||
    Number(form.maxTemp) !== sensor.maxTemp;

  function startEditing() {
    setSaved(false);
    setError('');
    setEditing(true);
  }

  function cancel() {
    setForm(formOf(sensor));
    setError('');
    setEditing(false);
  }

  async function save() {
    setError('');
    if (!changed) { setEditing(false); return; }
    if (!form.name.trim()) { setError('Sensor name is required'); return; }
    const min = Number(form.minTemp);
    const max = Number(form.maxTemp);
    if (isNaN(min) || isNaN(max)) { setError('Thresholds must be numbers'); return; }
    if (min >= max) { setError('Min must be less than max'); return; }

    setSaving(true);
    const result = await callApi(`/api/customers/${customerId}/sensors/${sensor.id}`, 'PATCH', {
      name: form.name, gatewayId: form.gatewayId, minTemp: min, maxTemp: max,
    });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSaved(true);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/customers/${customerId}`}>
            <ChevronLeft className="size-4" />
            Customer
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{sensor.name}</h1>
          <Badge variant={online ? 'ok' : 'offline'} dot>{online ? 'Online' : 'Offline'}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
          <CardTitle>Settings</CardTitle>
          {!editing ? (
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm font-medium text-ok-text">Saved.</span>}
              <Button variant="ghost" size="sm" onClick={startEditing}>
                <Pencil className="size-4" />
                Edit
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          )}
        </CardHeader>

        <dl className="space-y-4 px-5 py-5">
          <Field label="Sensor name">
            {editing
              ? <Input value={form.name} onChange={e => set('name')(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
              : <span className="font-medium">{sensor.name}</span>}
          </Field>
          <Field label="Gateway">
            {editing
              ? (
                <Select value={form.gatewayId} onChange={e => set('gatewayId')(e.target.value)}>
                  {gateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              )
              : gatewayName}
          </Field>
          <Field label="Temperature range">
            {editing
              ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Min" type="number" inputMode="decimal" step="0.5" suffix={TEMP_UNIT} value={form.minTemp} onChange={e => set('minTemp')(e.target.value)} />
                  <Input label="Max" type="number" inputMode="decimal" step="0.5" suffix={TEMP_UNIT} value={form.maxTemp} onChange={e => set('maxTemp')(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
                </div>
              )
              : <span className="tabular-nums">{sensor.minTemp}{TEMP_UNIT} to {sensor.maxTemp}{TEMP_UNIT}</span>}
          </Field>
          {/* No recipients row: the list is account-wide and edited on the
              customer page. The per-sensor list that used to live here promised
              per-fridge routing it could not deliver — the two lists were
              unioned, so it could only add people, and one email covers every
              alert open for a customer. */}
          <Field label="DevEUI">
            <span className="font-mono text-muted-foreground">{sensor.hardwareId || '—'}</span>
          </Field>
          {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
        </dl>
      </Card>
    </div>
  );
}
