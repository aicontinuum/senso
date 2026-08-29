'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

interface Props {
  emails: string[];
  onChange: (emails: string[]) => void;
}

export function EmailRecipientsEditor({ emails, onChange }: Props) {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  function add() {
    const e = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setError('Enter a valid email address (e.g. name@example.com)'); return; }
    if (emails.includes(e)) { setError('Already in the list'); return; }
    onChange([...emails, e]);
    setNewEmail('');
    setError('');
  }

  function remove(email: string) {
    onChange(emails.filter(e => e !== email));
  }

  return (
    <div className="space-y-1.5">
      {emails.length === 0 && (
        <p className="text-sm text-muted-foreground">None set.</p>
      )}
      {emails.map(email => (
        <div key={email} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <span className="truncate">{email}</span>
          <button
            onClick={() => remove(email)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${email}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="space-y-1 pt-1">
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="name@example.com"
            className={cn(
              'min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
              error ? 'border-alert-border focus:ring-alert-500' : 'border-border',
            )}
          />
          <button
            onClick={add}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {error && <p className="text-xs text-alert-text">{error}</p>}
      </div>
    </div>
  );
}
