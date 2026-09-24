'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { BranchForm } from '@/components/customers/BranchForm';
import type { Branch } from '@/types/branches';

// The customer's locations. Every customer has one from the day they are
// created; this card is where a second one is added when they open another
// site. A branch that has ever had a gateway cannot be removed, and the
// last one never can, so the row says so instead of offering a button.

type Props = {
  customerId: string;
  branches: Branch[];
  /** Live gateways, so each row can say how many sit at the branch. */
  gateways: { branch_id: string }[];
};

const ROW = 'flex items-center gap-4 px-5 py-3.5';

export function BranchesSection({ customerId, branches, gateways }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const gatewayCount = (branchId: string) => gateways.filter(g => g.branch_id === branchId).length;
  const canDelete = (branchId: string) => branches.length > 1 && gatewayCount(branchId) === 0;

  function done() {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  }

  async function remove(branchId: string) {
    setError('');
    setDeleting(true);
    const result = await callApi(`/api/customers/${customerId}/branches/${branchId}`, 'DELETE');
    setDeleting(false);
    if (!result.ok) { setError(result.error); return; }
    setConfirmDeleteId(null);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div>
          <div className="flex items-baseline gap-2">
            <CardTitle>Branches</CardTitle>
            <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{branches.length}</span>
          </div>
          <CardDescription>The customer&apos;s locations. Each gateway is installed at one of them.</CardDescription>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => { setEditingId(null); setAdding(true); }}>
            <Plus className="size-4" />
            Add branch
          </Button>
        )}
      </CardHeader>

      {adding && (
        <div className="border-b border-hairline px-5 py-4">
          <BranchForm customerId={customerId} onDone={done} onCancel={() => setAdding(false)} />
        </div>
      )}

      <ul className="divide-y divide-hairline">
        {branches.map(b => (
          <li key={b.id}>
            {editingId === b.id ? (
              <div className="px-5 py-4">
                <BranchForm customerId={customerId} branch={b} onDone={done} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div className={ROW}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.address ?? 'No address'}</p>
                </div>
                <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {gatewayCount(b.id)} {gatewayCount(b.id) === 1 ? 'gateway' : 'gateways'}
                  <br />
                  {b.alertRecipients.length === 0 ? 'account recipients' : `${b.alertRecipients.length} own ${b.alertRecipients.length === 1 ? 'recipient' : 'recipients'}`}
                </p>
                {confirmDeleteId === b.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Remove this branch?</span>
                    <Button variant="danger" size="sm" onClick={() => remove(b.id)} disabled={deleting}>{deleting ? 'Removing…' : 'Remove'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</Button>
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${b.name}`} title="Edit" onClick={() => { setAdding(false); setEditingId(b.id); }}>
                      <Pencil className="size-4" />
                    </Button>
                    {canDelete(b.id) && (
                      <Button variant="ghost" size="icon" aria-label={`Remove ${b.name}`} title="Remove" className="hover:text-alert-text" onClick={() => setConfirmDeleteId(b.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="px-5 pb-4 text-sm text-alert-text">{error}</p>}
    </Card>
  );
}
