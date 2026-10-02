'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { normaliseDevEui, isValidDevEui, normaliseAppKey, isValidAppKey } from '@/lib/deveui';
import { NETWORK_DEVICE_PROFILE, SENSOR_REPORTING_INTERVAL_MIN } from '@/lib/constants';

// Register a sensor on the network server so it can join and be decoded.
// The DevEUI and AppKey come off the device label; the profile and the
// reporting interval are the same for every sensor, so they are stated,
// not chosen.

export function RegisterSensorForm() {
  const router = useRouter();
  const [devEui, setDevEui] = useState('');
  const [appKey, setAppKey] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ devEui?: string; appKey?: string; name?: string; form?: string }>({});
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone('');
    const next: typeof errors = {};
    if (!isValidDevEui(normaliseDevEui(devEui))) next.devEui = 'Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c';
    if (!isValidAppKey(normaliseAppKey(appKey))) next.appKey = 'Invalid AppKey — expected 32 hex characters';
    if (!name.trim()) next.name = 'Sensor name is required';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    const result = await callApi<{ devEui: string; intervalQueued: boolean }>('/api/network/sensors', 'POST', {
      devEui: normaliseDevEui(devEui), appKey: normaliseAppKey(appKey), name,
    });
    setSaving(false);
    if (!result.ok) { setErrors({ form: result.error }); return; }
    setDone(result.data.intervalQueued
      ? `Registered ${result.data.devEui}. The ${SENSOR_REPORTING_INTERVAL_MIN}-minute interval is queued for its first uplink.`
      : `Registered ${result.data.devEui}, but the interval could not be queued; use Resend on its row.`);
    setDevEui('');
    setAppKey('');
    setName('');
    router.refresh();
  }

  const clear = (field: keyof typeof errors) => setErrors(ev => ({ ...ev, [field]: undefined, form: undefined }));
  const canSubmit = !saving && devEui.trim() !== '' && appKey.trim() !== '' && name.trim() !== '';

  return (
    <Card>
      <CardHeader className="border-b border-hairline">
        <CardTitle>Register a sensor</CardTitle>
        <CardDescription>
          Adds the sensor to the network server so it can join. Profile {NETWORK_DEVICE_PROFILE}; the {SENSOR_REPORTING_INTERVAL_MIN}-minute reporting interval is set on its first uplink. Add it to a customer afterwards on the customer&apos;s page.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent className="space-y-4 pt-5">
          <Input
            label="DevEUI"
            hint="From the label or QR on the sensor."
            value={devEui}
            onChange={e => { setDevEui(e.target.value); clear('devEui'); setDone(''); }}
            placeholder="a840419edb62011c"
            className="font-mono"
            autoComplete="off"
            autoCapitalize="none"
            error={errors.devEui}
          />
          <Input
            label="AppKey"
            hint="32 hex characters from the same label. Sent to the network server once; never stored here."
            value={appKey}
            onChange={e => { setAppKey(e.target.value); clear('appKey'); setDone(''); }}
            placeholder="32 hex characters"
            className="font-mono"
            autoComplete="off"
            autoCapitalize="none"
            error={errors.appKey}
          />
          <Input
            label="Name"
            hint="How it appears on the network server, e.g. the customer and fridge."
            value={name}
            onChange={e => { setName(e.target.value); clear('name'); setDone(''); }}
            placeholder="e.g. Fresh Foods — Walk-in fridge"
            error={errors.name}
          />
          {errors.form && <p role="alert" className="text-sm text-alert-text">{errors.form}</p>}
          {done && <p role="status" className="text-sm font-medium text-ok-text">{done}</p>}
          <div className="pt-1">
            <Button type="submit" disabled={!canSubmit}>{saving ? 'Registering…' : 'Register sensor'}</Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
