"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, cn } from "@senso/ui";
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

// One list for the account, and with several branches one row per branch
// under it. A row is collapsed by default and says at a glance whether the
// branch has a list of its own or falls back to the account's; opening it
// shows that branch's editor, one at a time, so thirteen branches are
// thirteen lines rather than thirteen forms. A single-branch customer sees
// only the account list, as before.
export function AlertRecipientsSection({ initialEmails, branches }: Props) {
  const multiBranch = hasBranches(branches);
  const [openId, setOpenId] = useState<string | null>(null);
  // The current list per branch, kept here so a row's summary is right after
  // an edit and a reopened editor starts from what was last saved.
  const [listByBranch, setListByBranch] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(branches.map((b) => [b.id, b.alertRecipients])));

  return (
    <SettingsCard
      title="Alert recipients"
      description={multiBranch
        ? "The account list is emailed about any branch that has no list of its own. Give a branch its own list and its alerts go there instead."
        : "These addresses are emailed when any sensor goes out of range or stops reporting."}
    >
      <div className="space-y-5">
        <div>
          {multiBranch && <h3 className="mb-2 text-sm font-semibold">Account</h3>}
          <RecipientListEditor
            label="account recipients"
            initialEmails={initialEmails}
            persist={(emails) => persistTo("/api/account", emails)}
            emptyMessage="None set — nobody will be emailed about alerts."
          />
        </div>

        {multiBranch && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Branches</h3>
            <ul className="-mx-2 divide-y divide-hairline">
              {branches.map((b) => {
                const list = listByBranch[b.id] ?? [];
                const open = openId === b.id;
                const own = list.length > 0;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : b.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-inner px-2 py-2.5 text-left transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{b.name}</span>
                        {own && <Badge variant="outline">Own list</Badge>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                        {own ? `${list.length} ${list.length === 1 ? "address" : "addresses"}` : "Uses account list"}
                        <ChevronDown className={cn("size-4 text-text-faint transition-transform duration-[--dur-fast] ease-[--ease-out]", open && "rotate-180")} />
                      </span>
                    </button>
                    {open && (
                      <div className="px-2 pb-4 pt-1 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
                        <RecipientListEditor
                          label={`${b.name} recipients`}
                          initialEmails={list}
                          persist={(emails) => persistTo(`/api/branches/${b.id}`, emails)}
                          onChange={(emails) => setListByBranch((m) => ({ ...m, [b.id]: emails }))}
                          emptyMessage="None of its own — this branch uses the account list."
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
