'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@senso/ui';

// Commissioning: the moment a sensor stops being a device on a bench and starts
// being part of a customer's compliance record. ONBOARDING.md §6 step 5.
//
// One direction only, deliberately. Putting a sensor *back* out of service would
// withdraw readings from a report the customer may already hold — a correction
// for a mis-commission, not a lifecycle step, and rare enough that it belongs
// with the office rather than on a button next to a rename. Retiring a sensor
// that really was in service is a different thing entirely and already exists:
// Unlink, which keeps its history in reports tagged "Retired".
//
// So the lifecycle is: register → commission → retire.

interface Props {
  customerId: string;
  sensorId: string;
  /** Null until a technician marks the sensor installed. */
  commissionedAt: string | null;
}

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommissioningPanel({ customerId, sensorId, commissionedAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function commission() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/customers/${customerId}/sensors/${sensorId}/commission`,
        { method: 'POST' },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? 'Could not update the sensor.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-hairline">
        <CardTitle>Service status</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {/* Words and the one button side by side from tablet width; on a
            phone the button takes its own full-width row. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              {commissionedAt ? 'In service' : 'Not in service'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {commissionedAt
                ? `Installed ${formatMoment(commissionedAt)}. Readings from this time onward alert the customer and appear in their reports.`
                : 'Readings are being stored but raise no alerts and appear in no report. Mark this sensor as installed once it is mounted at the site and reading correctly.'}
            </p>
          </div>
          {!commissionedAt && (
            <Button onClick={commission} disabled={busy} className="w-full shrink-0 sm:w-auto">
              {busy ? 'Marking…' : 'Mark as installed'}
            </Button>
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-alert-text">{error}</p>}
      </CardContent>
    </Card>
  );
}
