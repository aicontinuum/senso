"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Select } from "@senso/ui";
import { isValidRecipient, normaliseRecipient } from "@senso/recipients";
import { SettingsCard } from "./SettingsCard";
import { ALL_BRANCHES, hasBranches, type BranchOption } from "@/lib/branches";

interface Props {
  initialEmails: string[];
  branches: BranchOption[];
}

const SAVE_FAILED = "Could not save your changes. Please try again.";
const ALL_LABEL = "All branches";

// Saves a list through one of the account's API routes and reports the
// outcome in words the card can show.
async function persistTo(url: string, emails: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertRecipients: emails }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? SAVE_FAILED };
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

// One flat list: every address with the branch it is for, or "All branches".
// The rule is simple and the list says it: an all-branches address is
// emailed about any alert anywhere; a branch address only about its branch.
// Under the card the account list and each branch's list are still separate
// rows in the database; the add row's dropdown decides which one an address
// joins. Saved on every change, and the list only changes once the save has
// landed. A single-branch customer sees no dropdown and no tags.

type Scope = typeof ALL_BRANCHES | string;

export function AlertRecipientsSection({ initialEmails, branches }: Props) {
  const multiBranch = hasBranches(branches);
  // The lists as last saved, keyed by scope: the account under ALL_BRANCHES,
  // each branch under its id.
  const [lists, setLists] = useState<Record<Scope, string[]>>(() => ({
    [ALL_BRANCHES]: initialEmails,
    ...Object.fromEntries(branches.map((b) => [b.id, b.alertRecipients])),
  }));
  const [newEmail, setNewEmail] = useState("");
  const [newScope, setNewScope] = useState<Scope>(ALL_BRANCHES);
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const nameOf = (scope: Scope) => (scope === ALL_BRANCHES ? ALL_LABEL : branches.find((b) => b.id === scope)?.name ?? "");
  const urlOf = (scope: Scope) => (scope === ALL_BRANCHES ? "/api/account" : `/api/branches/${scope}`);

  // Rows in a fixed order: all-branches addresses first, then each branch in
  // its own order, so the list never shuffles after an edit.
  const scopes: Scope[] = [ALL_BRANCHES, ...(multiBranch ? branches.map((b) => b.id) : [])];
  const rows = scopes.flatMap((scope) => (lists[scope] ?? []).map((email) => ({ scope, email })));

  async function save(scope: Scope, updated: string[]): Promise<boolean> {
    setSaving(true);
    setSaveError("");
    const result = await persistTo(urlOf(scope), updated);
    setSaving(false);
    if (!result.ok) { setSaveError(result.error); return false; }
    setLists((m) => ({ ...m, [scope]: updated }));
    return true;
  }

  async function addEmail() {
    if (!isValidRecipient(newEmail)) {
      setEmailError("Enter a valid email address (e.g. name@example.com)");
      return;
    }
    const email = normaliseRecipient(newEmail);
    if ((lists[newScope] ?? []).includes(email)) {
      setEmailError(`This email is already on ${nameOf(newScope)}`);
      return;
    }
    setEmailError("");
    if (await save(newScope, [...(lists[newScope] ?? []), email])) setNewEmail("");
  }

  return (
    <SettingsCard
      title="Alert recipients"
      description={multiBranch
        ? "An address on All branches is emailed about any alert. An address on one branch is emailed only about that branch."
        : "These addresses are emailed when any sensor goes out of range or stops reporting."}
    >
      <div className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">None set — nobody will be emailed about alerts.</p>
        ) : (
          <Card tone="sunken" className="divide-y divide-hairline overflow-hidden">
            {rows.map(({ scope, email }) => (
              <div key={`${scope}:${email}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="truncate font-medium">{email}</span>
                  {multiBranch && (
                    <span className={scope === ALL_BRANCHES ? "text-xs font-medium" : "text-xs text-muted-foreground"}>{nameOf(scope)}</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => save(scope, (lists[scope] ?? []).filter((e) => e !== email))}
                  disabled={saving}
                  aria-label={`Remove ${email} from ${nameOf(scope)}`}
                  title="Remove"
                  className="size-7 shrink-0"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </Card>
        )}

        {/* Address, then which branch, then Add. Stacks on a phone. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Input
            aria-label="Email address to add"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); }}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            placeholder="name@example.com"
            error={emailError || undefined}
            wrapperClassName="min-w-0 flex-1"
          />
          {multiBranch && (
            <Select aria-label="Branch the address is for" value={newScope} onChange={(e) => setNewScope(e.target.value)} wrapperClassName="sm:w-44">
              <option value={ALL_BRANCHES}>{ALL_LABEL}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
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
