'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
};

type GatewayRow = {
  id: string;
  name: string | null;
  is_online: boolean;
  firmware_version: string | null;
  last_seen: string | null;
};

type SensorRow = {
  id: string;
  name: string;
  is_online: boolean;
  battery_level: number | null;
};

type AlertConfigRow = {
  id: string;
  sensor_id: string;
  min_temp: number;
  max_temp: number;
};

interface Props {
  customer: CustomerRow;
  gateways: GatewayRow[];
  sensors: SensorRow[];
  alertConfigs: AlertConfigRow[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-4"><h2 className="font-semibold">{title}</h2></div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, value, editing, onChange }: {
  label: string; value: string; editing: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <dt className="text-muted-foreground pt-1">{label}</dt>
      <dd className="col-span-2">
        {editing ? (
          <input
            value={value}
            onChange={e => onChange?.(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span>{value || '—'}</span>
        )}
      </dd>
    </div>
  );
}

export function CustomerDetailClient({ customer, gateways, sensors, alertConfigs }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: customer.name,
    contactName: customer.contact_name ?? '',
    email: customer.email,
    phone: customer.phone ?? '',
  });
  const set = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Customers
      </Link>

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              Cancel
            </button>
            <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Save
            </button>
          </div>
        )}
      </div>

      <Section title="Account Info">
        <dl className="space-y-3">
          <Field label="Business Name" value={form.name}        editing={editing} onChange={set('name')} />
          <Field label="Contact Name"  value={form.contactName} editing={editing} onChange={set('contactName')} />
          <Field label="Email"         value={form.email}       editing={editing} onChange={set('email')} />
          <Field label="Phone"         value={form.phone}       editing={editing} onChange={set('phone')} />
        </dl>
        <div className="mt-5 border-t pt-4">
          <p className="mb-2 text-sm font-medium">Change Password</p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="New password"
              className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Update</button>
          </div>
        </div>
      </Section>

      <Section title="Gateway">
        {gateways.length > 0 && (
          <div className="mb-4 space-y-2">
            {gateways.map(g => (
              <div key={g.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{g.name ?? g.id}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {g.id}
                    {g.firmware_version && ` · Firmware ${g.firmware_version}`}
                    {g.last_seen && ` · Last seen ${formatDate(g.last_seen)}`}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${g.is_online ? 'text-green-700' : 'text-muted-foreground'}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${g.is_online ? 'bg-green-500' : 'bg-zinc-400'}`} />
                  {g.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        )}
        {gateways.length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">No gateway linked yet.</p>
        )}
        <div className="flex gap-2">
          <input
            placeholder="Gateway ID or MAC address"
            className="flex-1 max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            Link Gateway
          </button>
        </div>
      </Section>

      <Section title={`Sensors (${sensors.length})`}>
        {sensors.length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">No sensors yet.</p>
        )}
        {sensors.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-8 font-medium">Name</th>
                  <th className="pb-2 pr-8 font-medium">Status</th>
                  <th className="pb-2 font-medium">Battery</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sensors.map(s => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-8 font-medium">{s.name}</td>
                    <td className="py-2.5 pr-8">
                      <span className={`flex items-center gap-1.5 ${s.is_online ? 'text-green-700' : 'text-muted-foreground'}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${s.is_online ? 'bg-green-500' : 'bg-zinc-400'}`} />
                        {s.is_online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {s.battery_level != null ? `${s.battery_level}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
          + Add Sensor
        </button>
      </Section>

      <Section title="Alert Thresholds">
        {alertConfigs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No thresholds configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-8 font-medium">Sensor</th>
                  <th className="pb-2 pr-8 font-medium">Min</th>
                  <th className="pb-2 font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {alertConfigs.map(ac => (
                  <tr key={ac.id}>
                    <td className="py-2.5 pr-8">{sensors.find(s => s.id === ac.sensor_id)?.name ?? ac.sensor_id}</td>
                    <td className="py-2.5 pr-8 font-mono">{ac.min_temp}°C</td>
                    <td className="py-2.5 font-mono">{ac.max_temp}°C</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
