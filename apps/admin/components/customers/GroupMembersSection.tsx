'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Unlink } from 'lucide-react';
import { Button, Card, CardDescription, CardHeader, CardTitle, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { GroupMember } from '@/lib/groups/load';

// The accounts an owner login can see. Linking is the whole job of a
// group, so Add sits in the header; unlinking asks once, since it removes
// the owner's view and nothing else.

type Props = {
  groupId: string;
  members: GroupMember[];
  /** Accounts that are neither groups nor already in one. */
  candidates: GroupMember[];
};

export function GroupMembersSection({ groupId, members, candidates }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [memberId, setMemberId] = useState(candidates[0]?.id ?? '');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function link() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/customers/${groupId}/members`, 'POST', { memberId });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setAdding(false);
    router.refresh();
  }

  async function unlink(id: string) {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/customers/${groupId}/members/${id}`, 'DELETE');
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setConfirmId(null);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div>
          <div className="flex items-baseline gap-2">
            <CardTitle>Members</CardTitle>
            <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{members.length}</span>
          </div>
          <CardDescription>The accounts this owner login can see. It can look at everything in them and change nothing.</CardDescription>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} disabled={candidates.length === 0} title={candidates.length === 0 ? 'Every account is already in a group' : undefined}>
            <Plus className="size-4" />
            Add member
          </Button>
        )}
      </CardHeader>

      {adding && (
        <div className="border-b border-hairline px-5 py-4">
          <Card tone="sunken" className="space-y-4 p-4 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
            <Select label="Account" hint="Only accounts not already in a group are listed." value={memberId} onChange={e => setMemberId(e.target.value)}>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
            </Select>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={link} disabled={busy || memberId === ''}>{busy ? 'Linking…' : 'Link account'}</Button>
              <Button variant="secondary" size="sm" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {members.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No members yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Link the accounts this owner should see with Add member.</p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {members.map(m => (
            <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <Link href={`/customers/${m.id}`} className="text-sm font-medium hover:underline">{m.name}</Link>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {confirmId === m.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Remove from this group? The account itself is untouched.</span>
                  <Button variant="danger" size="sm" onClick={() => unlink(m.id)} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)} disabled={busy}>Cancel</Button>
                </span>
              ) : (
                <Button variant="ghost" size="icon" aria-label={`Remove ${m.name} from the group`} title="Remove from group" className="hover:text-alert-text" onClick={() => setConfirmId(m.id)}>
                  <Unlink className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="px-5 pb-4 text-sm text-alert-text">{error}</p>}
    </Card>
  );
}
