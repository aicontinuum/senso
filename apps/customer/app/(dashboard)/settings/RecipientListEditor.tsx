"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button, Card, Input } from "@senso/ui";
import { isValidRecipient, normaliseRecipient } from "@senso/recipients";

// One list of addresses with an add row under it. Saved on every change:
// add an address, see it land, move on. Saves first and changes the list
// only on success, so an address is never shown as removed, or added,
// while the database still says otherwise.

interface Props {
  initialEmails: string[];
  /** Stores the whole list; resolves false (with the message set) on failure. */
  persist: (emails: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  emptyMessage: string;
  /** Names the list for assistive tech when several sit on one page. */
  label: string;
  /** Called with the new list once a save has landed. */
  onChange?: (emails: string[]) => void;
}

export function RecipientListEditor({ initialEmails, persist, emptyMessage, label, onChange }: Props) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save(updated: string[]): Promise<boolean> {
    setSaving(true);
    setSaveError("");
    const result = await persist(updated);
    setSaving(false);
    if (!result.ok) { setSaveError(result.error); return false; }
    setEmails(updated);
    onChange?.(updated);
    return true;
  }

  async function addEmail() {
    if (!isValidRecipient(newEmail)) {
      setEmailError("Enter a valid email address (e.g. name@example.com)");
      return;
    }
    const e = normaliseRecipient(newEmail);
    if (emails.includes(e)) {
      setEmailError("This email is already in the list");
      return;
    }
    setEmailError("");
    if (await save([...emails, e])) setNewEmail("");
  }

  return (
    <div className="space-y-4">
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <Card tone="sunken" className="divide-y divide-hairline overflow-hidden">
          {emails.map((email) => (
            <div key={email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate font-medium">{email}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => save(emails.filter((e) => e !== email))}
                disabled={saving}
                aria-label={`Remove ${email} from ${label}`}
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
          aria-label={`Add to ${label}`}
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
  );
}
