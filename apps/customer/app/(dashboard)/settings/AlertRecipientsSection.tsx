"use client";
import { SettingsCard } from "./SettingsCard";
import { RecipientListEditor } from "./RecipientListEditor";
import { hasBranches, type BranchOption } from "@/lib/branches";

interface Props {
  initialEmails: string[];
  branches: BranchOption[];
}

const SAVE_FAILED = "Could not save your changes. Please try again.";

// Saves a list through one of the account's API routes and reports the
// outcome in words the editor can show.
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

// One list for the account, and with several branches one more per branch
// that, when set, takes over for that branch's alerts. A single-branch
// customer sees only the account list, as before.
export function AlertRecipientsSection({ initialEmails, branches }: Props) {
  const multiBranch = hasBranches(branches);
  return (
    <SettingsCard
      title="Alert recipients"
      description={multiBranch
        ? "The account list is emailed about any branch that has no list of its own. Give a branch its own list and its alerts go there instead."
        : "These addresses are emailed when any sensor goes out of range or stops reporting."}
    >
      <div className="space-y-6">
        <div>
          {multiBranch && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Account</h3>}
          <RecipientListEditor
            label="account recipients"
            initialEmails={initialEmails}
            persist={(emails) => persistTo("/api/account", emails)}
            emptyMessage="None set — nobody will be emailed about alerts."
          />
        </div>
        {multiBranch && branches.map((b) => (
          <div key={b.id}>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{b.name}</h3>
            <RecipientListEditor
              label={`${b.name} recipients`}
              initialEmails={b.alertRecipients}
              persist={(emails) => persistTo(`/api/branches/${b.id}`, emails)}
              emptyMessage="None of its own — this branch uses the account list."
            />
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
