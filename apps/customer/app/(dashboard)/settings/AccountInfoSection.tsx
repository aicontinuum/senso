"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Customer } from "@senso/types";
import { cn } from "@/lib/utils";
import { Button, Input } from "@senso/ui";
import { Field } from "./Field";
import { SettingsCard } from "./SettingsCard";

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

  const action = !editing ? (
    <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setSaved(false); }}>
      <Pencil className="size-4" />
      Edit
    </Button>
  ) : (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
      <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );

  return (
    <SettingsCard title="Account info" action={action}>
      <div className="space-y-4">
        <Field label="Business name">
          <p className="text-sm font-medium">{customer.name}</p>
        </Field>
        <Field label="Contact name">
          {editing ? (
            <Input aria-label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          ) : (
            <p className="text-sm font-medium">{contactName || <span className="text-muted-foreground">Not set</span>}</p>
          )}
        </Field>
        <Field label="Contact email">
          <p className="text-sm font-medium">{customer.contactEmail}</p>
        </Field>
        <Field label="Phone">
          {editing ? (
            <Input aria-label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+974 xxxx xxxx" />
          ) : (
            <p className={cn("text-sm font-medium", !phone && "text-muted-foreground")}>
              {phone || "Not set"}
            </p>
          )}
        </Field>

        {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
        {saved && !editing && (
          <p className="text-sm font-medium text-ok-text">Changes saved.</p>
        )}
      </div>
    </SettingsCard>
  );
}
