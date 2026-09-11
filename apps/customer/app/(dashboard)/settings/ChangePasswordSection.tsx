"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@senso/ui";
import { SettingsCard } from "./SettingsCard";

const PASSWORD_MIN_LENGTH = 8;

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
    if (next.length < PASSWORD_MIN_LENGTH) {
      setError(`New password must be at least ${PASSWORD_MIN_LENGTH} characters`);
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

  const canSubmit = !saving && current !== "" && next !== "" && confirm !== "";

  return (
    <SettingsCard title="Change password">
      <div className="space-y-4">
        <Input
          label="Current password"
          type="password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); setError(""); }}
          autoComplete="current-password"
        />
        <Input
          label="New password"
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); setError(""); }}
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          autoComplete="new-password"
        />
        {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
        {saved && <p className="text-sm font-medium text-ok-text">Password updated.</p>}
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          <KeyRound className="size-4" />
          {saving ? "Updating…" : "Update password"}
        </Button>
      </div>
    </SettingsCard>
  );
}
