'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, CardContent, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';
import { networkName } from '@/lib/network/naming';
import { RegisterPage, RegisteredNotice } from '@/components/devices/RegisterPage';

// Register a gateway on the network server so it can relay packets. This
// is the radio side; linking it to a customer happens on the customer's
// page. Its network name is derived from the EUI (lib/network/naming.ts),
// so there is nothing to decide here.

export function RegisterGatewayForm() {
  const router = useRouter();
  const [eui, setEui] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const normalised = normaliseIdentifier(eui);
    if (!isValidGatewayId(normalised)) {
      setError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
      return;
    }
    setSaving(true);
    const result = await callApi<{ gatewayId: string; name: string }>('/api/network/gateways', 'POST', { eui: normalised });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setDone(result.data.name);
    setEui('');
    router.refresh();
  }

  const normalised = normaliseIdentifier(eui);
  const canSubmit = !saving && eui.trim() !== '';

  return (
    <RegisterPage
      title="Register a gateway"
      cardTitle="Gateway details"
      description="Adds the gateway to the network server so it can relay readings. Link it to a customer afterwards on the customer's page."
    >
      {done ? (
        <RegisteredNotice
          title="Gateway registered"
          message={`On the network server as ${done}. Link it to a customer on the customer's page.`}
          anotherLabel="Register another gateway"
          onAnother={() => setDone(null)}
        />
      ) : (
        <form onSubmit={submit} noValidate>
          <CardContent className="space-y-4 pt-5">
            <Input
              label="Gateway EUI"
              hint="From the label on the gateway."
              value={eui}
              onChange={e => { setEui(e.target.value); setError(''); }}
              placeholder="2cf7f11081400088"
              className="font-mono"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              error={error || undefined}
            />
            <p className="text-sm text-muted-foreground">
              Network name: <span className="font-mono text-foreground">{isValidGatewayId(normalised) ? networkName('gateway', normalised) : 'G-…'}</span>, from the EUI. What the site calls it is set when it is linked.
            </p>
          </CardContent>
          <div className="flex flex-col gap-2 border-t border-hairline px-5 py-4 sm:flex-row">
            <Button type="submit" disabled={!canSubmit}>{saving ? 'Registering…' : 'Register gateway'}</Button>
            <Button asChild variant="secondary">
              <Link href="/devices">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </RegisterPage>
  );
}
