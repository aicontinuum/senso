"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

interface Props {
  initialEmails: string[];
}

export function AlertRecipientsSection({ initialEmails }: Props) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function persist(updated: string[]) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertRecipients: updated }),
      });
      const data = await res.json();
      if (!res.ok) setSaveError(data.error ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      setEmailError("Enter a valid email address (e.g. name@example.com)");
      return;
    }
    if (emails.includes(e)) {
      setEmailError("This email is already in the list");
      return;
    }
    const updated = [...emails, e];
    setEmails(updated);
    setNewEmail("");
    setEmailError("");
    persist(updated);
  }

  function removeEmail(email: string) {
    const updated = emails.filter((e) => e !== email);
    setEmails(updated);
    persist(updated);
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Alert Recipients
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        These emails receive alerts from every sensor. Per-sensor recipients
        are additive — both lists are notified.
      </p>

      <div className="space-y-1.5">
        {emails.length === 0 && (
          <p className="py-1 text-sm text-muted-foreground">
            No account-wide recipients set.
          </p>
        )}
        {emails.map((email) => (
          <div
            key={email}
            className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <span className="truncate">{email}</span>
            <button
              onClick={() => removeEmail(email)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
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
              onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addEmail()}
              placeholder="name@example.com"
              className={cn(
                "min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
                emailError ? "border-red-400 focus:ring-red-400" : "border-input",
              )}
            />
            <button
              onClick={addEmail}
              className="flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {emailError && <p className="text-xs text-red-600">{emailError}</p>}
          {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
      </div>
    </section>
  );
}
