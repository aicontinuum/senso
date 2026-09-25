import { NextResponse } from 'next/server';
import { failureResponse, isDenied, requireAdmin } from '@/lib/billing/route-helpers';
import { requireUuid } from '@/lib/billing/validate';

/** Unlink an account from its group. Removes the owner's view and nothing
 *  else: the member's data, login and alerts are untouched. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, memberId } = await params;
    const { data, error } = await ctx.admin
      .from('customer_group_members')
      .delete()
      .eq('group_id', requireUuid(id, 'group'))
      .eq('member_id', requireUuid(memberId, 'member'))
      .select('member_id')
      .maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    if (!data) return NextResponse.json({ error: 'That account is not in this group' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('unlink member', error);
  }
}
