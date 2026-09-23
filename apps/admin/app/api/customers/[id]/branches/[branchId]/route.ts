import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { requireUuid } from '@/lib/billing/validate';
import { findCustomerBranch } from '@/lib/branches/load';
import { DUPLICATE_NAME_CODE, DUPLICATE_NAME_MESSAGE, parseBranchInput } from '@/lib/branches/input';
import { BRANCH_COLUMNS, toBranch, type BranchRow } from '@/types/branches';

type Params = { params: Promise<{ id: string; branchId: string }> };

const NOT_FOUND = NextResponse.json({ error: 'Branch not found' }, { status: 404 });

/** Rename a branch or change its address. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, branchId } = await params;
    const customerId = requireUuid(id, 'customer');
    const input = parseBranchInput(await readJson(request));
    if (!(await findCustomerBranch(ctx.admin, customerId, requireUuid(branchId, 'branch')))) return NOT_FOUND;

    const { data, error } = await ctx.admin
      .from('branches')
      .update({ name: input.name, address: input.address })
      .eq('id', branchId)
      .eq('customer_id', customerId)
      .select(BRANCH_COLUMNS)
      .single();
    if (error?.code === DUPLICATE_NAME_CODE) {
      return NextResponse.json({ error: DUPLICATE_NAME_MESSAGE }, { status: 409 });
    }
    if (error) throw new Error(`${error.code} ${error.message}`);

    return NextResponse.json({ branch: toBranch(data as unknown as BranchRow) });
  } catch (error) {
    return failureResponse('update branch', error);
  }
}

/** Remove a branch. Only an empty one can go: any gateway ever installed
 *  there, live or retired, keeps the branch as part of the record. The
 *  last branch stays too, so every customer always has one. */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, branchId } = await params;
    const customerId = requireUuid(id, 'customer');
    if (!(await findCustomerBranch(ctx.admin, customerId, requireUuid(branchId, 'branch')))) return NOT_FOUND;

    const [{ count: siblings, error: countError }, { count: gateways, error: gatewaysError }] = await Promise.all([
      ctx.admin.from('branches').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
      ctx.admin.from('gateways').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    ]);
    if (countError) throw new Error(countError.message);
    if (gatewaysError) throw new Error(gatewaysError.message);
    if ((siblings ?? 0) <= 1) {
      return NextResponse.json({ error: 'A customer must keep at least one branch' }, { status: 409 });
    }
    if ((gateways ?? 0) > 0) {
      return NextResponse.json(
        { error: 'A gateway has been installed at this branch, so it stays as part of the record. Move any live gateway first.' },
        { status: 409 },
      );
    }

    const { error } = await ctx.admin.from('branches').delete().eq('id', branchId).eq('customer_id', customerId);
    if (error) throw new Error(`${error.code} ${error.message}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('delete branch', error);
  }
}
