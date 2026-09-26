'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@senso/ui';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';
import { NETWORK_NOT_CONNECTED_NOTICE } from '@/lib/constants';

// Register a gateway on the network server so it can relay packets. This
// is the radio side; linking it to a customer happens on the customer's
// page. The fields are checked here; the send to the network server is
// not built yet, so a valid form ends at the notice.

export function RegisterGatewayForm() {
  const [eui, setEui] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    const normalised = normaliseIdentifier(eui);
    if (!isValidGatewayId(normalised)) {
      setError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
      return;
    }
    if (!name.trim()) { setError('Gateway name is required'); return; }
    setNotice(NETWORK_NOT_CONNECTED_NOTICE);
  }

  const canSubmit = eui.trim() !== '' && name.trim() !== '';

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
            onChange={e => { setEui(e.target.value); setError(''); setNotice(''); }}
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
            onChange={e => { setName(e.target.value); setNotice(''); }}
            placeholder="e.g. Fresh Foods — West Bay"
          />
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
          <div className="pt-1">
            <Button type="submit" disabled={!canSubmit}>Register gateway</Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
