import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function normaliseIdentifier(raw: string): string {
  const stripped = raw.replace(/[\s\-:]/g, '').toLowerCase();
  if (stripped.length === 16) return stripped;                             // LoRa EUI
  if (stripped.length === 12) return stripped.match(/.{2}/g)!.join(':'); // legacy MAC
  return raw.trim().toLowerCase();
}

const EUI_RE = /^[0-9a-f]{16}$/;
const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;
const COOLDOWN_MS = 30 * 60 * 1000;

type IngestReading = { hardware_id: string; temperature: number; recorded_at?: string };

export async function POST(request: Request) {
  const body = await request.json() as {
    mac_address: string;
    offline?: boolean;
    readings?: IngestReading[];
  };

  const { mac_address, offline, readings } = body;

  if (!mac_address) return NextResponse.json({ error: 'mac_address is required' }, { status: 400 });

  const identifier = normaliseIdentifier(mac_address);
  if (!EUI_RE.test(identifier) && !MAC_RE.test(identifier)) {
    return NextResponse.json({ error: 'Invalid gateway identifier' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: gateway } = await admin
    .from('gateways')
    .select('id')
    .eq('mac_address', identifier)
    .single();

  if (!gateway) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });

  if (offline) {
    await admin.from('gateways').update({ is_online: false }).eq('id', gateway.id);
    await admin.from('sensors').update({ status: 'offline' }).eq('gateway_id', gateway.id);
    return NextResponse.json({ offline: true });
  }

  const now = new Date().toISOString();
  await admin.from('gateways').update({ is_online: true, last_seen_at: now }).eq('id', gateway.id);

  let accepted = 0;
  let skipped = 0;

  for (const r of readings ?? []) {
    const { data: sensor } = await admin
      .from('sensors')
      .select('id')
      .eq('hardware_id', r.hardware_id)
      .eq('gateway_id', gateway.id)
      .single();

    if (!sensor) { skipped++; continue; }

    await admin.from('readings').insert({
      sensor_id: sensor.id,
      temperature: r.temperature,
      recorded_at: r.recorded_at ?? now,
    });

    await admin.from('sensors').update({ status: 'online' }).eq('id', sensor.id);

    const { data: configs } = await admin
      .from('alert_configs')
      .select('id, type, threshold')
      .eq('sensor_id', sensor.id);

    for (const config of configs ?? []) {
      const breaching =
        (config.type === 'min' && r.temperature < config.threshold) ||
        (config.type === 'max' && r.temperature > config.threshold);

      if (breaching) {
        const { data: existing } = await admin
          .from('alert_logs')
          .select('id, triggered_at')
          .eq('alert_config_id', config.id)
          .eq('is_resolved', false)
          .order('triggered_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!existing) {
          await admin.from('alert_logs').insert({
            alert_config_id: config.id,
            triggered_at: now,
            is_resolved: false,
          });
        } else if (Date.now() - new Date(existing.triggered_at).getTime() > COOLDOWN_MS) {
          await admin.from('alert_logs').update({ is_resolved: true }).eq('id', existing.id);
          await admin.from('alert_logs').insert({
            alert_config_id: config.id,
            triggered_at: now,
            is_resolved: false,
          });
        }
        // else: within cooldown — skip
      } else {
        await admin
          .from('alert_logs')
          .update({ is_resolved: true })
          .eq('alert_config_id', config.id)
          .eq('is_resolved', false);
      }
    }

    accepted++;
  }

  return NextResponse.json({ accepted, skipped });
}
