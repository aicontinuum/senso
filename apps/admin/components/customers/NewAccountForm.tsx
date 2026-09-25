'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronLeft, Plus } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';

// One form for both kinds of account. A customer and a group differ only
// in the flag sent with the request and the words around the fields. On
// success the page says what was made and offers the two next steps: the
// new account's page (for a group, where its members get linked) or
// another of the same kind.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const PASSWORD_MIN_LENGTH = 8;

type FieldKey = 'name' | 'contactName' | 'contactEmail' | 'phone' | 'password' | 'confirm';

type Field = {
  key: FieldKey;
  label: string;
  hint?: string;
  required: boolean;
  placeholder: string;
  type?: 'email' | 'tel' | 'password';
  inputMode?: 'email' | 'tel';
  autoComplete?: string;
};

const FIELDS: Field[] = [
  { key: 'name',         label: 'Business name',    required: true,  placeholder: 'e.g. Al Noor Pharmacy', autoComplete: 'organization' },
  { key: 'contactName',  label: 'Contact name',     required: true,  placeholder: 'Full name of the primary contact', autoComplete: 'name' },
  { key: 'contactEmail', label: 'Email address',    required: true,  placeholder: 'contact@business.com', type: 'email', inputMode: 'email', autoComplete: 'off', hint: 'They sign in with this.' },
  { key: 'phone',        label: 'Phone',            required: false, placeholder: '+974 XXXX XXXX', type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  { key: 'password',     label: 'Password',         required: true,  placeholder: `At least ${PASSWORD_MIN_LENGTH} characters`, type: 'password', autoComplete: 'new-password' },
  { key: 'confirm',      label: 'Confirm password', required: true,  placeholder: 'Repeat the password', type: 'password', autoComplete: 'new-password' },
];

const GROUP_FIELDS: Partial<Record<FieldKey, Partial<Field>>> = {
  name: { label: 'Group name', placeholder: 'e.g. Al Noor Group' },
};

type Form = Record<FieldKey, string>;
type Errors = Partial<Record<FieldKey, string>>;

const EMPTY: Form = { name: '', contactName: '', contactEmail: '', phone: '', password: '', confirm: '' };

type Props = {
  /** An owner login that reads its members and owns no devices. */
  isGroup: boolean;
};

export function NewAccountForm({ isGroup }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; email: string } | null>(null);

  const kind = isGroup ? 'group account' : 'customer';
  const fields = FIELDS.map(f => ({ ...f, ...(isGroup ? GROUP_FIELDS[f.key] : undefined) }));

  const set = (key: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    setErrors(ev => ({ ...ev, [key]: undefined }));
    setServerError('');
  };

  function validate(): Errors {
    const errs: Errors = {};
    for (const f of fields) {
      if (f.required && !form[f.key].trim()) errs[f.key] = 'Required';
    }
    if (form.contactEmail && !EMAIL_RE.test(form.contactEmail)) errs.contactEmail = 'Enter a valid email address';
    if (form.password && form.password.length < PASSWORD_MIN_LENGTH) errs.password = `At least ${PASSWORD_MIN_LENGTH} characters`;
    if (form.password && form.confirm && form.password !== form.confirm) errs.confirm = 'The passwords do not match';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    setServerError('');
    const result = await callApi<{ id: string }>('/api/customers', 'POST', {
      name: form.name,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      phone: form.phone,
      password: form.password,
      isGroup,
    });
    setLoading(false);
    if (!result.ok) { setServerError(result.error); return; }
    setCreated({ id: result.data.id, name: form.name, email: form.contactEmail });
    router.refresh();
  }

  function addAnother() {
    setForm(EMPTY);
    setErrors({});
    setCreated(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/customers">
            <ChevronLeft className="size-4" />
            Customers
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{isGroup ? 'New group account' : 'New customer'}</h1>
      </div>

      {created ? (
        <Card className="max-w-xl animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
          <CardContent className="space-y-4 px-5 py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-ok-soft text-ok-text">
              <Check className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-semibold">{isGroup ? 'Group account created' : 'Customer created'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{created.name}</span> can sign in with{' '}
                <span className="font-medium text-foreground">{created.email}</span>.
                {isGroup && ' It sees nothing until its member accounts are linked on its page.'}
              </p>
            </div>
            {/* One filled button: the step that is usually next. For a group
                that is linking members; for a customer, its page too, where
                the gateway gets linked. */}
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href={`/customers/${created.id}`}>
                  {isGroup ? 'Open group and link members' : 'Open customer'}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="secondary" onClick={addAnother}>
                <Plus className="size-4" />
                Add another {kind}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <CardHeader className="border-b border-hairline">
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              {isGroup
                ? 'An owner login that sees every account linked under it and changes nothing. It has no gateways or sensors of its own; link the member accounts on its page once it is created.'
                : 'A login for the customer portal. They sign in with this email and password.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4 pt-5">
              {fields.map(f => (
                <Input
                  key={f.key}
                  label={f.required ? f.label : `${f.label} (optional)`}
                  hint={f.hint}
                  type={f.type ?? 'text'}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete}
                  autoCapitalize={f.inputMode ? 'none' : undefined}
                  enterKeyHint={f.key === 'confirm' ? 'done' : 'next'}
                  value={form[f.key]}
                  onChange={set(f.key)}
                  placeholder={f.placeholder}
                  error={errors[f.key]}
                />
              ))}
              {serverError && <p role="alert" className="text-sm text-alert-text">{serverError}</p>}
            </CardContent>
            <div className="flex flex-col gap-2 border-t border-hairline px-5 py-4 sm:flex-row">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating…' : isGroup ? 'Create group account' : 'Create customer'}
              </Button>
              <Button asChild variant="secondary">
                <Link href="/customers">Cancel</Link>
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
