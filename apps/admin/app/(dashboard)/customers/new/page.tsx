'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

type Field = {
  label: string;
  key: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
};

const FIELDS: Field[] = [
  { label: 'Business Name',  key: 'name',           required: true,  placeholder: 'e.g. Al Noor Pharmacy' },
  { label: 'Contact Name',   key: 'contactName',    required: true,  placeholder: 'Full name of primary contact' },
  { label: 'Email Address',  key: 'contactEmail',   required: true,  placeholder: 'contact@business.com', type: 'email' },
  { label: 'Phone',          key: 'phone',          required: false, placeholder: '+974 XXXX XXXX' },
  { label: 'Username',       key: 'username',       required: true,  placeholder: 'Used to log in to the customer portal' },
  { label: 'Password',       key: 'password',       required: true,  type: 'password', placeholder: 'Min. 8 characters' },
  { label: 'Confirm Password', key: 'confirm',      required: true,  type: 'password', placeholder: 'Repeat password' },
];

export default function NewCustomerPage() {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(f => [f.key, '']))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    setErrors(ev => ({ ...ev, [key]: '' }));
  };

  function validate() {
    const errs: Record<string, string> = {};
    for (const f of FIELDS) {
      if (f.required && !form[f.key].trim()) errs[f.key] = 'Required';
    }
    if (form.contactEmail && !EMAIL_RE.test(form.contactEmail)) {
      errs.contactEmail = 'Enter a valid email address';
    }
    if (form.password && form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }
    if (form.password && form.confirm && form.password !== form.confirm) {
      errs.confirm = 'Passwords do not match';
    }
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setCreated(true);
  }

  if (created) {
    return (
      <div className="space-y-6">
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Customers
        </Link>
        <div className="rounded-lg border bg-card shadow-sm px-6 py-10 text-center space-y-3">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-lg">Customer created</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{form.name}</span> has been added.
            They can log in with username <span className="font-medium">{form.username}</span>.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/customers" className="text-sm px-4 py-2 rounded-md border border-border hover:bg-muted">
              Back to Customers
            </Link>
            <button
              onClick={() => { setForm(Object.fromEntries(FIELDS.map(f => [f.key, '']))); setCreated(false); }}
              className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Add Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Customers
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">New Customer</h1>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Account Details</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create login credentials the customer will use to access their portal.
          </p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key]}
                  onChange={set(f.key)}
                  placeholder={f.placeholder}
                  className={`w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${
                    errors[f.key] ? 'border-red-500' : 'border-border'
                  }`}
                />
                {errors[f.key] && (
                  <p className="mt-1 text-xs text-red-500">{errors[f.key]}</p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t px-6 py-4 flex gap-3">
            <button
              type="submit"
              className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create Customer
            </button>
            <Link
              href="/customers"
              className="text-sm px-4 py-2 rounded-md border border-border hover:bg-muted"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
