"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        <Input
          label="Current Password"
          type="password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); setError(""); }}
          autoComplete="current-password"
        />
        <Input
          label="New Password"
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); setError(""); }}
          autoComplete="new-password"
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          autoComplete="new-password"
        />
        {error && <p className="text-xs text-alert-text">{error}</p>}
        {saved && <p className="text-xs font-medium text-ok-text">✓ Password updated</p>}
        <Button block onClick={handleSubmit} disabled={saving}>
          {saving ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </section>
  );
}

