import { NextResponse } from 'next/server';
import { RECIPIENTS_MESSAGES, validateRecipients } from '@senso/recipients';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError, MAX_LABEL, optionalText, requireEmail, requireText, requireUuid } from '@/lib/billing/validate';

/** Edit a customer's contact details, and optionally its alert recipients. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);

    const updatePayload: Record<string, unknown> = {
      name: requireText(body.name, 'Business name', MAX_LABEL),
      contact_name: optionalText(body.contactName, 'contact name', MAX_LABEL),
      email: requireEmail(body.email, 'Email'),
      phone: optionalText(body.phone, 'phone', MAX_LABEL),
    };
    // These addresses are what the alert job sends to, so the list is checked
    // with the same rules the customer app applies and the normalised result
    // is what gets stored. One bad entry used to abort a whole alert run.
    if (body.alertRecipients !== undefined) {
      const result = validateRecipients(body.alertRecipients);
      if (!result.ok) throw new BillingInputError(RECIPIENTS_MESSAGES[result.error]);
      updatePayload.alert_recipients = result.value;
    }

    const { data, error } = await ctx.admin
      .from('customers')
      .update(updatePayload)
      .eq('id', customerId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    if (!data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('update customer', error);
  }
}
