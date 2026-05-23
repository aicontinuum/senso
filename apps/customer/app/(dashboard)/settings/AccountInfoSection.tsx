"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Customer } from "@senso/types";
import { cn } from "@/lib/utils";

export function AccountInfoSection({ customer }: { customer: Customer }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [contactName, setContactName] = useState(customer.contactName);
  const [email, setEmail] = useState(customer.contactEmail);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saved, setSaved] = useState(false);

  function cancel() {
    setName(customer.name);
    setContactName(customer.contactName);
    setEmail(customer.contactEmail);
    setPhone(customer.phone ?? "");
    setEditing(false);
  }

  function save() {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account Info
        </p>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setSaved(false); }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : (
          <button
            onClick={cancel}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-4">
        <Field label="Business Name">
          {editing ? (
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          ) : (
            <p className="text-sm font-medium">{name}</p>
          )}
        </Field>
        <Field label="Contact Name">
          {editing ? (
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
          ) : (
            <p className="text-sm font-medium">{contactName}</p>
          )}
        </Field>
        <Field label="Contact Email">
          {editing ? (
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          ) : (
            <p className="text-sm font-medium">{email}</p>
          )}
        </Field>
        <Field label="Phone">
          {editing ? (
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+974 xxxx xxxx" className={inputCls} />
          ) : (
            <p className={cn("text-sm font-medium", !phone && "text-muted-foreground")}>
              {phone || "Not set"}
            </p>
          )}
        </Field>

        {editing && (
          <button
            onClick={save}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save Changes
          </button>
        )}
        {saved && !editing && (
          <p className="text-center text-xs font-medium text-green-700">✓ Changes saved</p>
        )}
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
