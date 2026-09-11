"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@senso/ui";
import { SettingsCard } from "./SettingsCard";

const PASSWORD_MIN_LENGTH = 8;

// Collapsed by default: changing a password is a rare, deliberate act, and
// three empty password fields on every visit to Settings read as something
// that needs filling in. The card is its header until the button is pressed.
export function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
  }

  function openForm() {
    reset();
    setSaved(false);
    setOpen(true);
  }

  function cancel() {
    reset();
    setOpen(false);
  }

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

      reset();
      setOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !saving && current !== "" && next !== "" && confirm !== "";

  const action = open ? (
    <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
  ) : (
    <Button variant="secondary" size="sm" onClick={openForm}>
      <KeyRound className="size-4" />
      Change password
    </Button>
  );

  // Passed as one node, not two conditionals: an array of falses would still
  // count as children and give the collapsed card an empty body.
  const body = open ? (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
    >
      <Input
        label="Current password"
        type="password"
        value={current}
        onChange={(e) => { setCurrent(e.target.value); setError(""); }}
        autoComplete="current-password"
        autoFocus
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
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit}>
          {saving ? "Updating…" : "Update password"}
        </Button>
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  ) : saved ? (
    <p className="text-sm font-medium text-ok-text">Password updated.</p>
  ) : undefined;

  return (
    <SettingsCard
      title="Password"
      description={saved ? undefined : "Used to sign in to the dashboard."}
      action={action}
    >
      {body}
    </SettingsCard>
  );
}
