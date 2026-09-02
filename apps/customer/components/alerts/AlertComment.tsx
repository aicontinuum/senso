"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ALERT_COMMENT_MAX_LENGTH } from "@/lib/constants";
import { formatDateTimeLong } from "@/lib/temperature";

// Where a supervisor explains what an incident actually was.
//
// One note per alert, editable. It never suppresses the alert or removes a
// reading — the breach stands exactly as recorded, and the note travels with it
// into every report row that breach covers.

interface Props {
  alertId: string;
  initialBody: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  timezone: string;
}

export function AlertComment({ alertId, initialBody, createdAt, updatedAt, timezone }: Props) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody ?? "");
  const [draft, setDraft] = useState(initialBody ?? "");
  const [editing, setEditing] = useState(initialBody === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<{ created: string | null; updated: string | null }>({
    created: createdAt,
    updated: updatedAt,
  });

  const trimmed = draft.trim();
  const unchanged = trimmed === body.trim();

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/alerts/${alertId}/comment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Could not save the comment.");
        return;
      }
      setBody(payload.body);
      setDraft(payload.body);
      setSavedAt({ created: payload.createdAt, updated: payload.updatedAt });
      setEditing(false);
      // The report reads these too, so the cache holding the old value has to go.
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const edited =
    savedAt.created !== null &&
    savedAt.updated !== null &&
    new Date(savedAt.updated).getTime() - new Date(savedAt.created).getTime() > 1000;

  return (
    <section className="mt-6 rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Comments</h2>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => { setDraft(body); setEditing(true); }}>
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={ALERT_COMMENT_MAX_LENGTH}
            rows={3}
            placeholder="What was happening? e.g. cleaning the fridge, doors open"
            className="w-full rounded-control border border-border bg-card px-3.5 py-2.5 text-base text-foreground shadow-xs transition-[border-color,box-shadow] focus-within:border-primary focus:outline-none focus:ring-3 focus:ring-ring/32 placeholder:text-text-faint"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              {draft.length} / {ALERT_COMMENT_MAX_LENGTH}
            </span>
            <div className="flex items-center gap-2">
              {body !== "" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDraft(body); setEditing(false); setError(""); }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={saving || trimmed.length === 0 || unchanged}>
                {saving ? "Saving…" : "Submit"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This appears against every out-of-range reading of this incident in your reports.
          </p>
        </div>
      ) : (
        <div>
          {/* Deliberately whitespace-preserving: people write these in short
              lines and a note reflowed into one paragraph reads worse. */}
          <p className="whitespace-pre-wrap text-base">{body}</p>
          {savedAt.created && (
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDateTimeLong(savedAt.created, timezone)}
              {edited && savedAt.updated && (
                <> · edited {formatDateTimeLong(savedAt.updated, timezone)}</>
              )}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-alert-text">{error}</p>}
    </section>
  );
}
