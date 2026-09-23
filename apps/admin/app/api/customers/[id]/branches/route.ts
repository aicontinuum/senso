import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { requireUuid } from '@/lib/billing/validate';
import { DUPLICATE_NAME_CODE, DUPLICATE_NAME_MESSAGE, parseBranchInput } from '@/lib/branches/input';
import { BRANCH_COLUMNS, toBranch, type BranchRow } from '@/types/branches';

/** Add a branch to a customer. Admin only; customers never create branches. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const customerId = requireUuid((await params).id, 'customer');
    const input = parseBranchInput(await readJson(request));

    const { data, error } = await ctx.admin
      .from('branches')
      .insert({ customer_id: customerId, name: input.name, address: input.address })
      .select(BRANCH_COLUMNS)
      .single();
    if (error?.code === DUPLICATE_NAME_CODE) {
      return NextResponse.json({ error: DUPLICATE_NAME_MESSAGE }, { status: 409 });
    }
    if (error) throw new Error(`${error.code} ${error.message}`);

    return NextResponse.json({ branch: toBranch(data as unknown as BranchRow) }, { status: 201 });
  } catch (error) {
    return failureResponse('create branch', error);
  }
}
