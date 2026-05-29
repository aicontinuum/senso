"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Customer } from "@senso/types";
import { cn } from "@/lib/utils";

export function AccountInfoSection({ customer }: { customer: Customer }) {
  const [editing, setEditing] = useState(false);
  const [contactName, setContactName] = useState(customer.contactName);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function cancel() {
    setContactName(customer.contactName);
    setPhone(customer.phone ?? "");
    setError("");
    setEditing(false);
  }

  async function save() {
    setError("");
    const unchanged = contactName === customer.contactName && phone === (customer.phone ?? "");
    if (unchanged) { setEditing(false); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName, phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
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
          <p className="text-sm font-medium">{customer.name}</p>
        </Field>
        <Field label="Contact Name">
          {editing ? (
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
          ) : (
            <p className="text-sm font-medium">{contactName || <span className="text-muted-foreground">Not set</span>}</p>
          )}
        </Field>
        <Field label="Contact Email">
          <p className="text-sm font-medium">{customer.contactEmail}</p>
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
          <div className="space-y-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {error && <p className="text-center text-xs text-red-600">{error}</p>}
          </div>
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
