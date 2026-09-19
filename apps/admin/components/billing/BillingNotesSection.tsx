'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { BillingNote } from '@/types/billing';

// A dated log of what was said and promised. Newest first, append-only.

const timeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BillingNotesSection({ customerId, notes }: { customerId: string; notes: BillingNote[] }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (body.trim() === '') return;
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customerId}/notes`, 'POST', { body });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setBody('');
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline"><CardTitle>Notes</CardTitle></CardHeader>
      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start">
        <Input aria-label="New note" value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="e.g. Promised transfer by Thursday" error={error || undefined} />
        <Button variant="secondary" size="sm" className="h-10 self-start" onClick={add} disabled={busy || body.trim() === ''}>{busy ? 'Adding…' : 'Add note'}</Button>
      </div>
      {notes.length > 0 && (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {notes.map(n => (
            <li key={n.id} className="px-5 py-3 text-sm">
              <p className="text-xs text-muted-foreground">{timeFormatter.format(new Date(n.createdAt))}</p>
              <p className="mt-0.5 whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
