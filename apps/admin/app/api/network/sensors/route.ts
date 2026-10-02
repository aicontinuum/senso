import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError, MAX_LABEL, requireText } from '@/lib/billing/validate';
import { isValidAppKey, isValidDevEui, normaliseAppKey, normaliseDevEui } from '@/lib/deveui';
import { registerSensor } from '@/lib/network/registry';
import { requireRegistry, unwrap } from '@/lib/network/route';

/** Register a sensor on the network server: the device, its key, and the
 *  reporting interval queued for its first uplink. The AppKey passes
 *  through here once and is kept only by the network server. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const registry = requireRegistry();
    const body = await readJson(request);
    const devEui = normaliseDevEui(requireText(body.devEui, 'DevEUI', MAX_LABEL));
    if (!isValidDevEui(devEui)) throw new BillingInputError('Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c');
    const appKey = normaliseAppKey(requireText(body.appKey, 'AppKey', MAX_LABEL));
    if (!isValidAppKey(appKey)) throw new BillingInputError('Invalid AppKey — expected 32 hex characters');
    const name = requireText(body.name, 'Name', MAX_LABEL);

    const { intervalQueued } = unwrap(
      await registerSensor(registry, devEui, appKey, name),
      { exists: 'A sensor with this DevEUI is already registered' },
    );
    return NextResponse.json({ devEui, intervalQueued }, { status: 201 });
  } catch (error) {
    return failureResponse('register sensor', error);
  }
}
