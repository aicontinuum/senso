'use client';

import { Button } from '@senso/ui';

// The one shape for a confirmation or a small form that opens under a row:
// a title saying what is about to happen, a line of consequence, labelled
// fields if there are any, then a single filled button and a ghost Cancel.
// Destructive confirmations use the danger variant; nothing else differs,
// so Discard, Void, Send, Record payment and End plan all read the same.

type Props = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  error?: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function InlinePanel({
  title, description, children, error, confirmLabel, busyLabel, busy, danger = false, disabled = false, onConfirm, onCancel,
}: Props) {
  return (
    <div className="space-y-3 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
      {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
      <div className="flex gap-2">
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm} disabled={busy || disabled}>
          {busy ? busyLabel : confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
