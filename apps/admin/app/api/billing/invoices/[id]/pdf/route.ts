import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, failureResponse } from '@/lib/billing/route-helpers';
import { loadInvoiceBundle } from '@/lib/billing/invoice-load';
import { buildInvoicePdf, invoiceFilename } from '@/lib/billing/invoice-pdf';
import { requireUuid } from '@/lib/billing/validate';

// The PDF, built on request from the stored invoice. Nothing is cached: the
// invoice is immutable once issued, and a draft should print as it is now.
// Admin only; customers never reach this route.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const bundle = await loadInvoiceBundle(ctx.admin, id);
    if (!bundle) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const pdf = buildInvoicePdf(bundle.invoice, bundle.customer, bundle.settings);
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceFilename(bundle.invoice)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return failureResponse('invoice pdf', error);
  }
}
