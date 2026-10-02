'use client';

import { useState } from 'react';
import { Button, Card, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { AvailableDevices } from '@/lib/network/available';
import type { Branch } from '@/types/branches';

// Link a gateway chosen from those registered on the network server and
// not yet linked to anyone, so it always exists before it is linked. The
// branch picker appears only when the customer has more than one; with
// one, the server picks it.

type Props = {
  customerId: string;
  branches: Branch[];
  /** Registered on the network server, linked to no one: the choices. */
  available: AvailableDevices;
  onDone: () => void;
  onCancel: () => void;
};

export function LinkGatewayForm({ customerId, branches, available, onDone, onCancel }: Props) {
  const [eui, setEui] = useState('');
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);

  async function link() {
    setError('');
    if (!name.trim()) { setError('Gateway name is required'); return; }
    setLinking(true);
    const result = await callApi(`/api/customers/${customerId}/gateways`, 'POST', { macAddress: eui, name, branchId });
    setLinking(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }

  const canSubmit = !linking && eui.trim() !== '' && name.trim() !== '';

  return (
    <Card tone="sunken" className="space-y-4 p-4 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      <p className="text-sm font-semibold">Link a gateway</p>
      {available.state === 'unavailable' ? (
        <p className="text-sm text-alert-text">The network server did not answer, so the registered gateways cannot be listed. Try again in a minute.</p>
      ) : available.gateways.length === 0 ? (
        <p className="text-sm text-muted-foreground">No registered gateway is waiting. Register one on the Devices page first.</p>
      ) : (
        <Select
          label="Gateway"
          hint="Registered on the network server and not yet linked to a customer."
          value={eui}
          onChange={e => { setEui(e.target.value); setError(''); }}
        >
          <option value="">Choose a gateway</option>
          {available.gateways.map(g => (
            <option key={g.eui} value={g.eui}>{g.name ? `${g.name} · ${g.eui}` : g.eui}</option>
          ))}
        </Select>
      )}
      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && link()}
        placeholder="e.g. Kitchen gateway"
        error={error || undefined}
      />
      {branches.length > 1 && (
        <Select label="Branch" hint="Where this gateway is installed." value={branchId} onChange={e => setBranchId(e.target.value)}>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={link} disabled={!canSubmit}>{linking ? 'Linking…' : 'Link gateway'}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={linking}>Cancel</Button>
      </div>
    </Card>
  );
}
