'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-4"><h2 className="font-semibold">{title}</h2></div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm items-start">
      <dt className="text-muted-foreground pt-1">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

export function SensorSettingsClient({ customerId, sensor, gateways }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: sensor.name,
    gatewayId: sensor.gatewayId,
    minTemp: String(sensor.minTemp),
    maxTemp: String(sensor.maxTemp),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const changed =
    form.name !== sensor.name ||
    form.gatewayId !== sensor.gatewayId ||
    Number(form.minTemp) !== sensor.minTemp ||
    Number(form.maxTemp) !== sensor.maxTemp;

  async function save() {
    setError('');
    setSaved(false);
    if (!changed) return;

    const min = Number(form.minTemp);
    const max = Number(form.maxTemp);
    if (isNaN(min) || isNaN(max)) { setError('Thresholds must be numbers'); return; }
    if (min >= max) { setError('Min must be less than max'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/sensors/${sensor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, gatewayId: form.gatewayId, minTemp: min, maxTemp: max }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return; }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href={`/customers/${customerId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Customer
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sensor.name}</h1>
          <span className={`mt-1 inline-flex items-center gap-1.5 text-sm ${sensor.status === 'online' ? 'text-green-700' : 'text-muted-foreground'}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${sensor.status === 'online' ? 'bg-green-500' : 'bg-zinc-400'}`} />
            {sensor.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <Section title="Settings">
        <dl className="space-y-4">
          <Row label="Sensor Name">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </Row>

          <Row label="Gateway">
            <select
              value={form.gatewayId}
              onChange={e => setForm(f => ({ ...f, gatewayId: e.target.value }))}
              className={inputCls}
            >
              {gateways.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Row>

          <Row label="Temperature Threshold">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Min</span>
                <input
                  type="number"
                  step="0.5"
                  value={form.minTemp}
                  onChange={e => setForm(f => ({ ...f, minTemp: e.target.value }))}
                  className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
              <span className="text-muted-foreground">—</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Max</span>
                <input
                  type="number"
                  step="0.5"
                  value={form.maxTemp}
                  onChange={e => setForm(f => ({ ...f, maxTemp: e.target.value }))}
                  className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
            </div>
          </Row>

          <Row label="Hardware ID">
            <span className="font-mono text-sm text-muted-foreground">{sensor.hardwareId || '—'}</span>
          </Row>
        </dl>

        <div className="mt-6 flex items-center gap-3 border-t pt-4">
          <button
            onClick={save}
            disabled={saving || !changed}
            className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && <p className="text-xs text-green-700">✓ Saved</p>}
        </div>
      </Section>
    </div>
  );
}
