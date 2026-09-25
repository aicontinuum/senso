import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin, ruleOrThrow } from '@/lib/billing/route-helpers';
import { requireUuid } from '@/lib/billing/validate';

/** Link an account under a group. The database refuses anything that is
 *  not a group, a group as a member, or an account already in a group;
 *  those come back as 409 in the words the migration raises. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const groupId = requireUuid((await params).id, 'group');
    const body = await readJson(request);
    const memberId = requireUuid(body.memberId, 'member');

    const { error } = await ctx.admin
      .from('customer_group_members')
      .insert({ group_id: groupId, member_id: memberId });
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'That account is already in a group' }, { status: 409 });
    }
    ruleOrThrow(error);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return failureResponse('link member', error);
  }
}
