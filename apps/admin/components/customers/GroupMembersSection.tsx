'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Unlink } from 'lucide-react';
import { Button, Card, CardDescription, CardHeader, CardTitle, Select, cn } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { AccountRef, GroupMember } from '@/lib/groups/load';
import { InlinePanel } from '@/components/billing/InlinePanel';
import { GatewayDot, LIST_ROW, sensorsLabel } from '@/components/customers/CustomersTable';

// The accounts an owner login can see, each a row you can open, with its
// device health beside the name: the question an admin opening a group
// has is which of its sites is in trouble. Linking is the whole job of a
// group, so Add sits in the header; unlinking opens the one confirmation
// shape every other card uses, under the row, since it removes the
// owner's view and nothing else.

type Props = {
  groupId: string;
  members: GroupMember[];
  /** Accounts that are neither groups nor already in one. */
  candidates: AccountRef[];
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

  function openAdd() {
    setError('');
    setConfirmId(null);
    setAdding(true);
  }

  function openRemove(id: string) {
    setError('');
    setAdding(false);
    setConfirmId(id);
  }

  return (
    <Card className="overflow-hidden">
      {/* Title and words first, the button beside them from tablet width
          and on its own full-width row on a phone. */}
      <CardHeader className="flex-col gap-3 space-y-0 border-b border-hairline sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <CardTitle>Members</CardTitle>
            <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{members.length}</span>
          </div>
          <CardDescription>The accounts this owner login can see. It can look at everything in them and change nothing.</CardDescription>
        </div>
        {!adding && (
          <Button size="sm" onClick={openAdd} disabled={candidates.length === 0} title={candidates.length === 0 ? 'Every account is already in a group' : undefined} className="w-full shrink-0 sm:w-auto">
            <Plus className="size-4" />
            Add member
          </Button>
        )}
      </CardHeader>

      {adding && (
        <div className="border-b border-hairline bg-sunken px-5 py-4">
          <InlinePanel
            title="Link an account"
            description="Only accounts not already in a group are listed. The account itself is unchanged; this owner login can now see it."
            error={error}
            confirmLabel="Link account"
            busyLabel="Linking…"
            busy={busy}
            disabled={memberId === ''}
            onConfirm={link}
            onCancel={() => setAdding(false)}
          >
            <Select label="Account" value={memberId} onChange={e => setMemberId(e.target.value)} wrapperClassName="sm:max-w-md">
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
            </Select>
          </InlinePanel>
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
            <li key={m.id}>
              <div className="flex items-center">
                {/* The row opens the account; the unlink button sits after
                    it, outside the link, so a tap on the name never removes. */}
                <Link href={`/customers/${m.id}`} className={cn(LIST_ROW, 'min-w-0 flex-1 pr-2')}>
                  <GatewayDot status={m.gwStatus} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">{sensorsLabel(m)}</p>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${m.name} from the group`}
                  title="Remove from group"
                  className="mr-3 shrink-0 text-muted-foreground hover:text-alert-text"
                  onClick={() => openRemove(m.id)}
                  disabled={busy}
                >
                  <Unlink className="size-4" />
                </Button>
              </div>
              {confirmId === m.id && (
                <div className="border-t border-hairline bg-sunken px-5 py-4">
                  <InlinePanel
                    title={`Remove ${m.name} from this group?`}
                    description="The owner login stops seeing this account. The account itself, its devices and its login are untouched."
                    error={error}
                    confirmLabel="Remove"
                    busyLabel="Removing…"
                    busy={busy}
                    danger
                    onConfirm={() => unlink(m.id)}
                    onCancel={() => setConfirmId(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
