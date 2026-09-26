import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { loadSettings } from '@/lib/billing/detail';
import { BillingInputError, optionalEmail, optionalText, requireCount, requireMoney, requireText, MAX_LABEL } from '@/lib/billing/validate';

// The one settings row. Every field on it is editable here; the whole form
// is sent each time and written as one update, so the row is never half of
// two versions. Only the invoice prefix has a shape rule (short, uppercase
// letters) because it becomes part of every number.

const PREFIX_RE = /^[A-Z]{1,6}$/;
const MAX_TAX_RATE = 1; // stored as a fraction; 1 = 100 %

export async function PATCH(request: Request) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin } = ctx;

  try {
    const body = await readJson(request);

    const billingEmail = optionalEmail(body.billingEmail, 'billing email');
    const invoicePrefix = requireText(body.invoicePrefix, 'invoice prefix', 6).toUpperCase();
    if (!PREFIX_RE.test(invoicePrefix)) throw new BillingInputError('invoice prefix must be 1–6 letters');
    const taxRate = requireMoney(body.taxRatePercent, 'tax rate') / 100;
    if (taxRate > MAX_TAX_RATE) throw new BillingInputError('tax rate cannot exceed 100 %');

    const { error } = await admin.from('billing_settings').update({
      company_name: requireText(body.companyName, 'company name', MAX_LABEL),
      cr_number: optionalText(body.crNumber, 'CR number', MAX_LABEL),
      address: optionalText(body.address, 'address'),
      phone: optionalText(body.phone, 'phone', MAX_LABEL),
      billing_email: billingEmail,
      logo_url: optionalText(body.logoUrl, 'logo URL'),
      bank_name: optionalText(body.bankName, 'bank name', MAX_LABEL),
      account_name: optionalText(body.accountName, 'account name', MAX_LABEL),
      iban: optionalText(body.iban, 'IBAN', MAX_LABEL),
      fawran_alias: optionalText(body.fawranAlias, 'Fawran alias', MAX_LABEL),
      tax_registration_number: optionalText(body.taxRegistrationNumber, 'tax registration number', MAX_LABEL),
      tax_rate: taxRate,
      invoice_prefix: invoicePrefix,
      payment_terms_days: requireCount(body.paymentTermsDays, 'payment terms'),
      renewal_notice_days: requireCount(body.renewalNoticeDays, 'renewal notice days'),
      suspension_after_days: requireCount(body.suspensionAfterDays, 'suspension after days'),
      starter_monthly: requireMoney(body.starterMonthly, 'Starter monthly'),
      standard_monthly: requireMoney(body.standardMonthly, 'Standard monthly'),
      addon_monthly: requireMoney(body.addonMonthly, 'add-on monthly'),
      addon_monthly_custom: requireMoney(body.addonMonthlyCustom, 'Custom add-on monthly'),
      updated_at: new Date().toISOString(),
    }).eq('id', true);
    ruleOrThrow(error);

    return NextResponse.json({ settings: await loadSettings(admin) });
  } catch (error) {
    return failureResponse('update settings', error);
  }
}
