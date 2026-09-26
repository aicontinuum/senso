import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { requirePassword, requireUuid } from '@/lib/billing/validate';

/** Set a new password on a customer's login: the office-side reset a
 *  technician uses when handing over credentials. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const customerId = requireUuid((await params).id, 'customer');
    const password = requirePassword((await readJson(request)).password);

    const { data: customer, error: readError } = await ctx.admin
      .from('customers')
      .select('auth_user_id')
      .eq('id', customerId)
      .maybeSingle();
    if (readError) throw new Error(`${readError.code} ${readError.message}`);
    if (!customer?.auth_user_id) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { error } = await ctx.admin.auth.admin.updateUserById(customer.auth_user_id, { password });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('update password', error);
  }
}
