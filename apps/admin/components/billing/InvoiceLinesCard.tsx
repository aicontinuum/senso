'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle } from '@senso/ui';
import { formatMoney } from '@/lib/format';
import { IssuedInvoiceEditor } from '@/components/billing/IssuedInvoiceEditor';
import type { Invoice } from '@/types/billing';

// What an issued invoice says, read-only, with the one edit the freeze
// allows: the wording, the due date and the discount label. A voided
// invoice is history and gets no Edit.

const TH = 'px-5 py-3 font-medium';
const TD = 'px-5 py-3';

export function InvoiceLinesCard({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const editable = invoice.state === 'sent' || invoice.state === 'paid';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <CardTitle>Lines</CardTitle>
        {editable && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit wording
          </Button>
        )}
      </CardHeader>
      {editing ? (
        <div className="px-5 py-4">
          <IssuedInvoiceEditor invoice={invoice} onSaved={() => { setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-muted-foreground">
              <th className={TH}>Description</th>
              <th className={`${TH} text-right`}>Qty</th>
              <th className={`${TH} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {invoice.lines.map(l => (
              <tr key={l.id}>
                <td className={TD}>{l.description}</td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>{l.quantity}</td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
