'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-4">
        <h2 className="font-semibold">Service status</h2>
      </div>
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
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
            <button
              onClick={commission}
              disabled={busy}
              className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Mark as installed'}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-alert-text">{error}</p>}
      </div>
    </div>
  );
}
