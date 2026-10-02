'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';

// Register a gateway on the network server so it can relay packets. This
// is the radio side; linking it to a customer happens on the customer's
// page.

export function RegisterGatewayForm() {
  const router = useRouter();
  const [eui, setEui] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    const normalised = normaliseIdentifier(eui);
    if (!isValidGatewayId(normalised)) {
      setError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
      return;
    }
    if (!name.trim()) { setError('Gateway name is required'); return; }
    setSaving(true);
    const result = await callApi<{ gatewayId: string }>('/api/network/gateways', 'POST', { eui: normalised, name });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setDone(`Registered ${result.data.gatewayId}. Link it to a customer on the customer's page.`);
    setEui('');
    setName('');
    router.refresh();
  }

  const canSubmit = !saving && eui.trim() !== '' && name.trim() !== '';

  return (
    <Card>
      <CardHeader className="border-b border-hairline">
        <CardTitle>Register a gateway</CardTitle>
        <CardDescription>
          Adds the gateway to the network server so it can relay readings. Link it to a customer afterwards on the customer&apos;s page.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent className="space-y-4 pt-5">
          <Input
            label="Gateway EUI"
            hint="From the label on the gateway."
            value={eui}
            onChange={e => { setEui(e.target.value); setError(''); setDone(''); }}
            placeholder="2cf7f11081400088"
            className="font-mono"
            autoComplete="off"
            autoCapitalize="none"
            error={error || undefined}
          />
          <Input
            label="Name"
            hint="How it appears on the network server, e.g. the customer and site."
            value={name}
            onChange={e => { setName(e.target.value); setDone(''); }}
            placeholder="e.g. Fresh Foods — West Bay"
          />
          {done && <p role="status" className="text-sm font-medium text-ok-text">{done}</p>}
          <div className="pt-1">
            <Button type="submit" disabled={!canSubmit}>{saving ? 'Registering…' : 'Register gateway'}</Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
