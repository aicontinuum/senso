'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Commissioning: the moment a sensor stops being a device on a bench and starts
// being part of a customer's compliance record. ONBOARDING.md step 7 has always
// said "mark the sensor active" — this is that step.
//
// Kept out of SensorSettingsClient deliberately. The settings form edits how a
// sensor behaves; this changes what its history means, and mixing the two would
// put an irreversible-feeling action behind the same Save button as a rename.

const MAX_REASON_LENGTH = 300;

interface Props {
  customerId: string;
  sensorId: string;
  /** Null when the sensor has never been put into service. */
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
  const inService = commissionedAt !== null;

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(action: 'commission' | 'uncommission') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/customers/${customerId}/sensors/${sensorId}/commission`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason: reason.trim() || undefined }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? 'Could not update the sensor.');
        return;
      }
      setConfirming(false);
      setReason('');
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
              {inService ? 'In service' : 'Not in service'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {inService
                ? `Installed ${formatMoment(commissionedAt)}. Readings from this time onward alert the customer and appear in their reports.`
                : 'Readings are being stored but raise no alerts and appear in no report. Mark this sensor as installed once it is mounted at the site and reading correctly.'}
            </p>
          </div>
          {!confirming && (
            <button
              onClick={() => (inService ? setConfirming(true) : submit('commission'))}
              disabled={busy}
              className={
                inService
                  ? 'shrink-0 rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted disabled:opacity-50'
                  : 'shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
              }
            >
              {busy ? 'Working…' : inService ? 'Take out of service' : 'Mark as installed'}
            </button>
          )}
        </div>

        {/* Taking a sensor out of service removes readings from a report the
            customer may already have produced, so it asks for a reason rather
            than a confirmation — the reason is what makes the change auditable
            afterwards. */}
        {confirming && (
          <div className="space-y-3 rounded-md border border-warn-border bg-warn-soft p-4">
            <p className="text-sm font-medium text-warn-text">
              This removes every reading before now from the customer&apos;s reports.
            </p>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={MAX_REASON_LENGTH}
                rows={2}
                placeholder="e.g. commissioned against the wrong DevEUI"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setConfirming(false); setReason(''); setError(''); }}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submit('uncommission')}
                disabled={busy || reason.trim().length === 0}
                className="rounded-md bg-alert-500 px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Take out of service'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-alert-text">{error}</p>}
      </div>
    </div>
  );
}
