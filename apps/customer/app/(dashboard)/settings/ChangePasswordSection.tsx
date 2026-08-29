"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    setError("");
    setSaved(false);

    if (!current || !next || !confirm) {
      setError("All fields are required");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Session error — please log in again");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (signInError) {
        setError("Current password is incorrect");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Change Password
      </p>
      <div className="space-y-3">
        <Field label="Current Password">
          <input
            type="password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setError(""); }}
            autoComplete="current-password"
            className={inputCls}
          />
        </Field>
        <Field label="New Password">
          <input
            type="password"
            value={next}
            onChange={(e) => { setNext(e.target.value); setError(""); }}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
        <Field label="Confirm New Password">
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(""); }}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
        {error && <p className="text-xs text-alert-text">{error}</p>}
        {saved && <p className="text-xs font-medium text-ok-text">✓ Password updated</p>}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Updating…" : "Update Password"}
        </button>
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
