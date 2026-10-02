import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError, requireUuid } from '@/lib/billing/validate';

/** Mark a customer as a test account, or back as a real one. A test
 *  account's money is left out of every billing total. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const customerId = requireUuid((await params).id, 'customer');
    const { isTest } = await readJson(request);
    if (typeof isTest !== 'boolean') throw new BillingInputError('isTest must be true or false');

    const { data, error } = await ctx.admin
      .from('customers').update({ is_test: isTest }).eq('id', customerId).select('id').maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    if (!data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({ success: true, isTest });
  } catch (error) {
    return failureResponse('mark test account', error);
  }
}
