"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button, Card, Input } from "@senso/ui";
import { SettingsCard } from "./SettingsCard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

interface Props {
  initialEmails: string[];
}

// The one recipient list for the account. Saved on every change: add an
// address, see it land, move on.
export function AlertRecipientsSection({ initialEmails }: Props) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Saves first and changes the list only on success, so an address is never
  // shown as removed, or added, while the database still says otherwise.
  async function persist(updated: string[]): Promise<boolean> {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertRecipients: updated }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Could not save your changes. Please try again.");
        return false;
      }
      setEmails(updated);
      return true;
    } catch {
      setSaveError("Could not save your changes. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      setEmailError("Enter a valid email address (e.g. name@example.com)");
      return;
    }
    if (emails.includes(e)) {
      setEmailError("This email is already in the list");
      return;
    }
    setEmailError("");
    if (await persist([...emails, e])) setNewEmail("");
  }

  function removeEmail(email: string) {
    persist(emails.filter((e) => e !== email));
  }

  return (
    <SettingsCard
      title="Alert recipients"
      description="These addresses are emailed when any sensor goes out of range or stops reporting."
    >
      <div className="space-y-4">
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None set — nobody will be emailed about alerts.
          </p>
        ) : (
          <Card tone="sunken" className="divide-y divide-hairline overflow-hidden">
            {emails.map((email) => (
              <div key={email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate font-medium">{email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEmail(email)}
                  disabled={saving}
                  aria-label={`Remove ${email}`}
                  title="Remove"
                  className="size-7 shrink-0"
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
            aria-label="Add alert recipient"
            type="email"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); }}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            placeholder="name@example.com"
            error={emailError || undefined}
            wrapperClassName="min-w-0 flex-1"
          />
          <Button variant="secondary" onClick={addEmail} disabled={saving || newEmail.trim() === ""} className="self-start">
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
        {saveError && <p role="alert" className="text-sm text-alert-text">{saveError}</p>}
      </div>
    </SettingsCard>
  );
}
