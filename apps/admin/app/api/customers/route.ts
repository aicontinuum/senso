import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { MAX_LABEL, optionalBoolean, optionalText, requireEmail, requirePassword, requireText } from '@/lib/billing/validate';

/** Supabase Auth refuses a second login with the same address under this code. */
const EMAIL_TAKEN_CODE = 'email_exists';

/** Create a customer or a group account: a login, then the customer row
 *  linked to it. If the row cannot be written the login is removed again,
 *  so a failed attempt leaves nothing behind. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const body = await readJson(request);
    const input = {
      name: requireText(body.name, 'name', MAX_LABEL),
      contactName: optionalText(body.contactName, 'contact name', MAX_LABEL),
      email: requireEmail(body.contactEmail, 'email'),
      phone: optionalText(body.phone, 'phone', MAX_LABEL),
      password: requirePassword(body.password),
      // An owner login: reads the accounts linked under it, owns no devices.
      isGroup: optionalBoolean(body.isGroup, 'isGroup'),
    };

    const { data: authData, error: authError } = await ctx.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (authError?.code === EMAIL_TAKEN_CODE) {
      return NextResponse.json({ error: 'A login with this email address already exists' }, { status: 409 });
    }
    if (authError || !authData.user) throw new Error(`${authError?.code ?? ''} ${authError?.message ?? 'no user returned'}`);

    // The new row's id comes back so the form can offer the account's page next.
    const { data: created, error: dbError } = await ctx.admin
      .from('customers')
      .insert({
        name: input.name,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        auth_user_id: authData.user.id,
        status: 'active',
        is_group: input.isGroup,
      })
      .select('id')
      .single();
    if (dbError || !created) {
      await ctx.admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`${dbError?.code ?? ''} ${dbError?.message ?? 'no row returned'}`);
    }

    return NextResponse.json({ id: created.id });
  } catch (error) {
    return failureResponse('create customer', error);
  }
}
