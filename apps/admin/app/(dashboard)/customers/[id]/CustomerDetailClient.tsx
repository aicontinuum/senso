'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { EmailRecipientsEditor } from '@/components/EmailRecipientsEditor';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';
import { normaliseDevEui, isValidDevEui } from '@/lib/deveui';

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  alert_recipients: string[] | null;
};

type GatewayRow = {
  id: string;
  name: string | null;
  is_online: boolean;
  firmware_version: string | null;
  last_seen_at: string | null;
  mac_address: string | null;
};

type SensorRow = {
  id: string;
  name: string;
  status: string;
  battery_level: number | null;
  gateway_id: string;
  /** Null until a technician marks the sensor installed. */
  commissioned_at: string | null;
};

interface Props {
  customer: CustomerRow;
  gateways: GatewayRow[];
  sensors: SensorRow[];
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

export function CustomerDetailClient({ customer, gateways, sensors }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    name: customer.name,
    contactName: customer.contact_name ?? '',
    email: customer.email,
    phone: customer.phone ?? '',
  });
  const set = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  async function saveAccount() {
    setSaveError('');
    const unchanged =
      form.name === customer.name &&
      form.contactName === (customer.contact_name ?? '') &&
      form.email === customer.email &&
      form.phone === (customer.phone ?? '');
    if (unchanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save changes');
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const [euiInput, setEuiInput] = useState('');
  const [gwName, setGwName] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [addingSensor, setAddingSensor] = useState(false);
  const [sensorForm, setSensorForm] = useState({ gatewayId: gateways[0]?.id ?? '', name: '', hardwareId: '' });
  const [sensorError, setSensorError] = useState('');
  const [savingSensor, setSavingSensor] = useState(false);
  const setSensorField = (key: keyof typeof sensorForm) => (v: string) => setSensorForm(f => ({ ...f, [key]: v }));
  const [confirmUnlinkSensorId, setConfirmUnlinkSensorId] = useState<string | null>(null);
  const [unlinkingSensor, setUnlinkingSensor] = useState(false);

  const [acctEmails, setAcctEmails] = useState<string[]>(customer.alert_recipients ?? []);
  const [savingAcctEmails, setSavingAcctEmails] = useState(false);
  const [acctEmailError, setAcctEmailError] = useState('');

  async function saveAcctEmails(emails: string[]) {
    setAcctEmails(emails);
    setAcctEmailError('');
    setSavingAcctEmails(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customer.name,
          contactName: customer.contact_name,
          email: customer.email,
          phone: customer.phone,
          alertRecipients: emails,
        }),
      });
      const data = await res.json();
      if (!res.ok) setAcctEmailError(data.error ?? 'Failed to save');
    } finally {
      setSavingAcctEmails(false);
    }
  }

  async function linkGateway() {
    setLinkError('');
    const normalised = normaliseIdentifier(euiInput);
    if (!isValidGatewayId(normalised)) {
      setLinkError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
      return;
    }
    if (!gwName.trim()) {
      setLinkError('Gateway name is required');
      return;
    }

    setLinking(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/gateways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: normalised, name: gwName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data.error ?? 'Failed to link gateway');
        return;
      }
      setEuiInput('');
      setGwName('');
      router.refresh();
    } finally {
      setLinking(false);
    }
  }

  async function updatePassword() {
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error ?? 'Failed to update password');
        return;
      }
      setNewPassword('');
      setPasswordSuccess(true);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function addSensor() {
    setSensorError('');
    // Normalise here as well as server-side, so a DevEUI pasted from a label or QR
    // with colons or dashes is accepted rather than bounced back to the technician.
    const devEui = normaliseDevEui(sensorForm.hardwareId);
    if (!isValidDevEui(devEui)) {
      setSensorError('Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c');
      return;
    }
    setSavingSensor(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sensorForm, hardwareId: devEui }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSensorError(data.error ?? 'Failed to add sensor');
        return;
      }
      setAddingSensor(false);
      setSensorForm({ gatewayId: gateways[0]?.id ?? '', name: '', hardwareId: '' });
      router.refresh();
    } finally {
      setSavingSensor(false);
    }
  }

  async function unlinkSensor(sensorId: string) {
    setUnlinkingSensor(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/sensors/${sensorId}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmUnlinkSensorId(null);
        router.refresh();
      }
    } finally {
      setUnlinkingSensor(false);
    }
  }

  async function unlinkGateway(gatewayId: string) {
    const linkedSensors = sensors.filter(s => s.gateway_id === gatewayId);
    if (linkedSensors.length > 0) {
      const ok = window.confirm(
        `This gateway has ${linkedSensors.length} sensor${linkedSensors.length > 1 ? 's' : ''} linked to it (${linkedSensors.map(s => s.name).join(', ')}).\n\nRemoving the gateway will also retire all linked sensors. Their recorded readings are kept for the compliance history. Proceed?`
      );
      if (!ok) {
        setConfirmUnlinkId(null);
        return;
      }
    }
    setUnlinking(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/gateways/${gatewayId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConfirmUnlinkId(null);
        router.refresh();
      }
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Customers
      </Link>

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
        {!editing ? (
          <button onClick={() => { setSaveError(''); setEditing(true); }} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Edit</button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setSaveError(''); setForm({ name: customer.name, contactName: customer.contact_name ?? '', email: customer.email, phone: customer.phone ?? '' }); }} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Cancel</button>
              <button onClick={saveAccount} disabled={saving} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Saving…' : 'Save'}</button>
            </div>
            {saveError && <p className="text-xs text-alert-text">{saveError}</p>}
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
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(false); }}
                onKeyDown={e => e.key === 'Enter' && updatePassword()}
                placeholder="New password"
                className={`w-48 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${passwordError ? 'border-alert-border focus:ring-alert-500' : 'border-border'}`}
              />
              <button
                onClick={updatePassword}
                disabled={passwordSaving || !newPassword}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? 'Updating…' : 'Update'}
              </button>
            </div>
            {passwordError && <p className="text-xs text-alert-text">{passwordError}</p>}
            {passwordSuccess && <p className="text-xs text-ok-text">Password updated.</p>}
          </div>
        </div>
      </Section>

      <Section title="Gateway">
        {gateways.length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">No gateway linked yet.</p>
        )}
        {gateways.length > 0 && (
          <div className="mb-4 space-y-2">
            {gateways.map(g => (
              <div key={g.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{g.name ?? g.id}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {g.id}
                    {g.mac_address && ` · EUI: ${g.mac_address}`}
                    {g.firmware_version && ` · Firmware ${g.firmware_version}`}
                    {g.last_seen_at && ` · Last seen ${formatDate(g.last_seen_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${g.is_online ? 'text-ok-text' : 'text-muted-foreground'}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${g.is_online ? 'bg-ok-500' : 'bg-offline-500'}`} />
                    {g.is_online ? 'Online' : 'Offline'}
                  </span>
                  {confirmUnlinkId === g.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Unlink?</span>
                      <button
                        onClick={() => unlinkGateway(g.id)}
                        disabled={unlinking}
                        className="font-medium text-alert-text hover:text-alert-text disabled:opacity-50"
                      >
                        {unlinking ? 'Removing…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmUnlinkId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmUnlinkId(g.id)}
                      className="text-xs text-muted-foreground hover:text-alert-text"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={euiInput}
              onChange={e => { setEuiInput(e.target.value); setLinkError(''); }}
              onKeyDown={e => e.key === 'Enter' && linkGateway()}
              placeholder="Gateway EUI (e.g. 2cf7f11081400088)"
              className={`flex-1 max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${linkError ? 'border-alert-border focus:ring-alert-500' : 'border-border'}`}
            />
            <input
              value={gwName}
              onChange={e => setGwName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && linkGateway()}
              placeholder="Name"
              className="w-36 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={linkGateway}
              disabled={linking || !euiInput.trim() || !gwName.trim()}
              className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {linking ? 'Linking…' : 'Link Gateway'}
            </button>
          </div>
          {linkError && <p className="text-xs text-alert-text">{linkError}</p>}
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
                  <th className="pb-2 pr-8 font-medium">Gateway</th>
                  <th className="pb-2 pr-8 font-medium">Status</th>
                  <th className="pb-2 pr-8 font-medium">Battery</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sensors.map(s => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-8 font-medium">{s.name}</td>
                    <td className="py-2.5 pr-8 text-muted-foreground">
                      {gateways.find(g => g.id === s.gateway_id)?.name ?? '—'}
                    </td>
                    <td className="py-2.5 pr-8">
                      {/* Not commissioned outranks online/offline: the sensor may
                          be reporting perfectly and still not be monitoring
                          anything the customer owns. */}
                      {s.commissioned_at === null ? (
                        <span className="flex items-center gap-1.5 text-warn-text">
                          <span className="inline-block h-2 w-2 rounded-full bg-warn-500" />
                          Not in service
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1.5 ${s.status === 'online' ? 'text-ok-text' : 'text-muted-foreground'}`}>
                          <span className={`inline-block h-2 w-2 rounded-full ${s.status === 'online' ? 'bg-ok-500' : 'bg-offline-500'}`} />
                          {s.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {s.battery_level != null ? `${s.battery_level}%` : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      {confirmUnlinkSensorId === s.id ? (
                        <span className="flex items-center justify-end gap-1.5 text-xs">
                          <span className="text-muted-foreground">Remove?</span>
                          <button onClick={() => unlinkSensor(s.id)} disabled={unlinkingSensor} className="font-medium text-alert-text hover:text-alert-text disabled:opacity-50">
                            {unlinkingSensor ? 'Removing…' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmUnlinkSensorId(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-3">
                          <Link href={`/customers/${customer.id}/sensors/${s.id}`} className="text-xs text-muted-foreground hover:text-foreground">Settings</Link>
                          <button onClick={() => setConfirmUnlinkSensorId(s.id)} className="text-xs text-muted-foreground hover:text-alert-text">Remove</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!addingSensor ? (
          <button
            onClick={() => { setSensorForm({ gatewayId: gateways[0]?.id ?? '', name: '', hardwareId: '' }); setAddingSensor(true); }}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            + Add Sensor
          </button>
        ) : (
          <div className="mt-2 space-y-3 rounded-md border border-border p-4">
            <p className="text-sm font-medium">New Sensor</p>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Gateway</label>
              {gateways.length === 0 ? (
                <p className="text-sm text-muted-foreground">No gateways linked — add a gateway first.</p>
              ) : (
                <select
                  value={sensorForm.gatewayId}
                  onChange={e => setSensorField('gatewayId')(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {gateways.map(g => (
                    <option key={g.id} value={g.id}>{g.name ?? g.id}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Sensor Name</label>
              <input
                value={sensorForm.name}
                onChange={e => setSensorField('name')(e.target.value)}
                placeholder="e.g. Cold Storage A"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">DevEUI (from the sensor label / QR)</label>
              <input
                value={sensorForm.hardwareId}
                onChange={e => setSensorField('hardwareId')(e.target.value)}
                placeholder="a840419edb62011c"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {sensorError && <p className="text-xs text-alert-text">{sensorError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={addSensor}
                disabled={savingSensor || !sensorForm.gatewayId || !sensorForm.name.trim() || !sensorForm.hardwareId.trim()}
                className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingSensor ? 'Adding…' : 'Add Sensor'}
              </button>
              <button
                onClick={() => { setAddingSensor(false); setSensorError(''); }}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Alert Recipients">
        <p className="mb-4 text-sm text-muted-foreground">
          These emails receive alerts from every sensor on this account. This is the only recipient list — the customer edits the same one in their Settings.
        </p>
        <EmailRecipientsEditor emails={acctEmails} onChange={saveAcctEmails} />
        {savingAcctEmails && <p className="mt-2 text-xs text-muted-foreground">Saving…</p>}
        {acctEmailError && <p className="mt-2 text-xs text-alert-text">{acctEmailError}</p>}
      </Section>
    </div>
  );
}
