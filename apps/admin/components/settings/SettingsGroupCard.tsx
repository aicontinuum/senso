'use client';

import { Pencil } from 'lucide-react';
import { Button, Card, CardDescription, CardHeader, CardTitle, Input, cn } from '@senso/ui';
import type { SettingsForm, SettingsGroup } from '@/components/settings/billing-settings-groups';

// One group of billing settings as a card: read as label and value pairs,
// with one Edit button, and only while editing the same pairs as fields
// with Save and Cancel. The same shape as the customer's Account info
// card, so settings read the same everywhere in admin.

type Props = {
  group: SettingsGroup;
  form: SettingsForm;
  editing: boolean;
  /** Another card is open; this one waits rather than opening a second. */
  locked: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
  onChange: (key: keyof SettingsForm, value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export function SettingsGroupCard({ group, form, editing, locked, saving, saved, error, onChange, onEdit, onCancel, onSave }: Props) {
  return (
    <Card asChild className="overflow-hidden">
      <section aria-label={group.title}>
        {/* Title and words first; the buttons beside them from tablet width
            and, while editing, an even full-width pair on a phone. */}
        <CardHeader className={cn(
          'gap-3 space-y-0 border-b border-hairline sm:flex-row sm:items-start sm:justify-between',
          editing ? 'flex-col' : 'flex-row items-start justify-between',
        )}>
          <div>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.hint}</CardDescription>
          </div>
          {editing ? (
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving} className="flex-1 sm:flex-none">Cancel</Button>
              <Button size="sm" onClick={onSave} disabled={saving} className="flex-1 sm:flex-none">{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-3">
              {saved && <span className="text-sm font-medium text-ok-text">Saved.</span>}
              <Button variant="ghost" size="sm" onClick={onEdit} disabled={locked}>
                <Pencil className="size-4" />
                Edit
              </Button>
            </div>
          )}
        </CardHeader>

        <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
          {group.fields.map(f => (
            <div key={f.key} className="min-w-0">
              {editing ? (
                <Input
                  label={f.label}
                  value={form[f.key]}
                  onChange={e => onChange(f.key, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !saving && onSave()}
                  {...f.input}
                />
              ) : (
                <>
                  <dt className="text-xs font-semibold text-muted-foreground">{f.label}</dt>
                  <dd className={cn('mt-1 text-sm', f.viewClassName)}>
                    {form[f.key].trim() === '' ? <Dash /> : f.view ? f.view(form[f.key]) : form[f.key]}
                  </dd>
                </>
              )}
            </div>
          ))}
        </dl>
        {error && <p role="alert" className="px-5 pb-5 text-sm text-alert-text">{error}</p>}
      </section>
    </Card>
  );
}
