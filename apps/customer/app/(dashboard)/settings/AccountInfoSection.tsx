"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Customer } from "@senso/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditing(true); setSaved(false); }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <Field label="Business Name">
          <p className="text-sm font-medium">{customer.name}</p>
        </Field>
        <Field label="Contact Name">
          {editing ? (
            <Input aria-label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          ) : (
            <p className="text-sm font-medium">{contactName || <span className="text-muted-foreground">Not set</span>}</p>
          )}
        </Field>
        <Field label="Contact Email">
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

        {editing && (
          <div className="space-y-1.5">
            <Button block onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            {error && <p className="text-center text-xs text-alert-text">{error}</p>}
          </div>
        )}
        {saved && !editing && (
          <p className="text-center text-xs font-medium text-ok-text">✓ Changes saved</p>
        )}
      </div>
    </section>
  );
}

