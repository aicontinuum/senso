'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, CardContent, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { normaliseDevEui, isValidDevEui, normaliseAppKey, isValidAppKey } from '@/lib/deveui';
import { NETWORK_DEVICE_PROFILE, SENSOR_REPORTING_INTERVAL_MIN } from '@/lib/constants';
import { networkName } from '@/lib/network/naming';
import { RegisterPage, RegisteredNotice } from '@/components/devices/RegisterPage';

// Register a sensor on the network server so it can join and be decoded.
// The DevEUI and AppKey come off the device label; the profile and the
// reporting interval are the same for every sensor, so they are stated,
// not chosen, and the network name is derived from the DevEUI
// (lib/network/naming.ts). What the fridge is called is set at install.

const IDENTIFIER_INPUT = {
  className: 'font-mono',
  autoComplete: 'off',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
} as const;

export function RegisterSensorForm() {
  const router = useRouter();
  const [devEui, setDevEui] = useState('');
  const [appKey, setAppKey] = useState('');
  const [errors, setErrors] = useState<{ devEui?: string; appKey?: string; form?: string }>({});
  const [done, setDone] = useState<{ name: string; intervalQueued: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidDevEui(normaliseDevEui(devEui))) next.devEui = 'Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c';
    if (!isValidAppKey(normaliseAppKey(appKey))) next.appKey = 'Invalid AppKey — expected 32 hex characters';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    const result = await callApi<{ devEui: string; name: string; intervalQueued: boolean }>('/api/network/sensors', 'POST', {
      devEui: normaliseDevEui(devEui), appKey: normaliseAppKey(appKey),
    });
    setSaving(false);
    if (!result.ok) { setErrors({ form: result.error }); return; }
    setDone({ name: result.data.name, intervalQueued: result.data.intervalQueued });
    setDevEui('');
    setAppKey('');
    router.refresh();
  }

  const clear = (field: keyof typeof errors) => setErrors(ev => ({ ...ev, [field]: undefined, form: undefined }));
  const normalised = normaliseDevEui(devEui);
  const canSubmit = !saving && devEui.trim() !== '' && appKey.trim() !== '';

  return (
    <RegisterPage
      title="Register a sensor"
      cardTitle="Sensor details"
      description={`Adds the sensor to the network server so it can join. Profile ${NETWORK_DEVICE_PROFILE}; the ${SENSOR_REPORTING_INTERVAL_MIN}-minute reporting interval is set on its first uplink. Add it to a customer afterwards on the customer's page.`}
    >
      {done ? (
        <RegisteredNotice
          title="Sensor registered"
          message={done.intervalQueued
            ? `On the network server as ${done.name}. The ${SENSOR_REPORTING_INTERVAL_MIN}-minute interval is queued for its first uplink.`
            : `On the network server as ${done.name}, but the interval could not be queued; use Resend on its row in the list.`}
          anotherLabel="Register another sensor"
          onAnother={() => setDone(null)}
        />
      ) : (
        <form onSubmit={submit} noValidate>
          <CardContent className="space-y-4 pt-5">
            <Input
              label="DevEUI"
              hint="From the label or QR on the sensor."
              value={devEui}
              onChange={e => { setDevEui(e.target.value); clear('devEui'); }}
              placeholder="a840419edb62011c"
              enterKeyHint="next"
              error={errors.devEui}
              {...IDENTIFIER_INPUT}
            />
            <Input
              label="AppKey"
              hint="32 hex characters from the same label. Sent to the network server once; never stored here."
              value={appKey}
              onChange={e => { setAppKey(e.target.value); clear('appKey'); }}
              placeholder="32 hex characters"
              enterKeyHint="done"
              error={errors.appKey}
              {...IDENTIFIER_INPUT}
            />
            <p className="text-sm text-muted-foreground">
              Network name: <span className="font-mono text-foreground">{isValidDevEui(normalised) ? networkName('sensor', normalised) : 'S-…'}</span>, from the DevEUI. What the fridge is called is set when it is added to a customer.
            </p>
            {errors.form && <p role="alert" className="text-sm text-alert-text">{errors.form}</p>}
          </CardContent>
          <div className="flex flex-col gap-2 border-t border-hairline px-5 py-4 sm:flex-row">
            <Button type="submit" disabled={!canSubmit}>{saving ? 'Registering…' : 'Register sensor'}</Button>
            <Button asChild variant="secondary">
              <Link href="/devices">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </RegisterPage>
  );
}
