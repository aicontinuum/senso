"use client";
import { useState } from "react";

export function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSubmit() {
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
    setError("");
    setCurrent("");
    setNext("");
    setConfirm("");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && <p className="text-xs font-medium text-green-700">✓ Password updated</p>}
        <button
          onClick={handleSubmit}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Update Password
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
