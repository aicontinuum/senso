'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button, Card, Input } from '@senso/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

interface Props {
  emails: string[];
  /** Resolves true once the change is saved; the list only moves on success. */
  onChange: (emails: string[]) => Promise<boolean>;
  /** Disables the controls while a save is in flight. */
  saving?: boolean;
}

// A list of addresses with an add row underneath. Each change is handed up to
// the caller to save; the list shown is always the caller's, so an address is
// never shown as gone, or added, while the database still says otherwise.
export function EmailRecipientsEditor({ emails, onChange, saving = false }: Props) {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  async function add() {
    const e = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setError('Enter a valid email address (e.g. name@example.com)'); return; }
    if (emails.includes(e)) { setError('Already in the list'); return; }
    setError('');
    if (await onChange([...emails, e])) setNewEmail('');
  }

  function remove(email: string) {
    onChange(emails.filter(e => e !== email));
  }

  return (
    <div className="space-y-4">
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">None set — nobody will be emailed about this account&apos;s alerts.</p>
      ) : (
        <Card tone="sunken" className="divide-y divide-hairline overflow-hidden">
          {emails.map(email => (
            <div key={email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate font-medium">{email}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => remove(email)}
                disabled={saving}
                aria-label={`Remove ${email}`}
                title="Remove"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Stacks on a phone: side by side the button falls off the card edge. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Input
          type="email"
          value={newEmail}
          onChange={e => { setNewEmail(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="name@example.com"
          aria-label="Email address to add"
          error={error || undefined}
          wrapperClassName="max-w-sm"
        />
        <Button variant="secondary" className="self-start" onClick={add} disabled={saving || newEmail.trim() === ''}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
