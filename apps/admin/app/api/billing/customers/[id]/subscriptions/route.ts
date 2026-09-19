import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent, recordOverrides } from '@/lib/billing/events';
import { loadSettings, SUBSCRIPTION_COLUMNS, toSubscription, type SubscriptionRow } from '@/lib/billing/detail';
import { parseSubscriptionInput, proposalFor } from '@/lib/billing/subscription-input';
import { requireUuid } from '@/lib/billing/validate';
import { TERM_LABEL } from '@/lib/billing/constants';

// Create a plan for a customer. The body carries what the admin typed; the
// proposal is recomputed here so any figure that differs from it is logged
// as an override with the reason given.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const settings = await loadSettings(admin);
    const input = parseSubscriptionInput(body, settings);

    const { data, error } = await admin
      .from('subscriptions')
      .insert({
        customer_id: customerId,
        label: input.label,
        tier: input.tier,
        sensor_count: input.sensorCount,
        addon_count: input.addonCount,
        addon_monthly_rate: input.addonMonthlyRate,
        term_months: input.termMonths,
        monthly_rate: input.monthlyRate,
        term_total: input.termTotal,
        term_start: input.termStart,
        renewal_date: input.renewalDate,
      })
      .select(SUBSCRIPTION_COLUMNS)
      .single();
    ruleOrThrow(error);
    const subscription = toSubscription(data as unknown as SubscriptionRow);

    await recordBillingEvent(admin, {
      customerId, actorId, kind: EVENT_KIND.subscriptionCreated, subscriptionId: subscription.id,
      newValue: `${input.tier} · ${TERM_LABEL[input.termMonths]} · ${input.termTotal}`, reason: input.reason,
    });
    await recordOverrides(
      admin,
      { customerId, actorId, subscriptionId: subscription.id, reason: input.reason },
      proposalFor(settings, input),
      { monthly_rate: input.monthlyRate, addon_monthly_rate: input.addonMonthlyRate, term_total: input.termTotal, renewal_date: input.renewalDate },
    );

    return NextResponse.json({ subscription });
  } catch (error) {
    return failureResponse('create subscription', error);
  }
}
