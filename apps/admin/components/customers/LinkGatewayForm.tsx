'use client';

import { useState } from 'react';
import { Button, Card, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';
import type { Branch } from '@/types/branches';

// Link a gateway by its EUI. The branch picker appears only when the
// customer has more than one; with one, the server picks it.

type Props = {
  customerId: string;
  branches: Branch[];
  onDone: () => void;
  onCancel: () => void;
};

export function LinkGatewayForm({ customerId, branches, onDone, onCancel }: Props) {
  const [eui, setEui] = useState('');
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);

  async function link() {
    setError('');
    const normalised = normaliseIdentifier(eui);
    if (!isValidGatewayId(normalised)) {
      setError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
      return;
    }
    if (!name.trim()) { setError('Gateway name is required'); return; }
    setLinking(true);
    const result = await callApi(`/api/customers/${customerId}/gateways`, 'POST', { macAddress: normalised, name, branchId });
    setLinking(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }

  const canSubmit = !linking && eui.trim() !== '' && name.trim() !== '';

  return (
    <Card tone="sunken" className="space-y-4 p-4 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      <p className="text-sm font-semibold">Link a gateway</p>
      <Input
        label="Gateway EUI"
        hint="From the label on the gateway."
        value={eui}
        onChange={e => { setEui(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && link()}
        placeholder="2cf7f11081400088"
        className="font-mono"
        error={error || undefined}
      />
      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && link()}
        placeholder="e.g. Kitchen gateway"
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
