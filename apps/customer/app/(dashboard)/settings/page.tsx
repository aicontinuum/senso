"use client";
import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "senso_global_emails";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export default function SettingsPage() {
  const [emails, setEmails] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEmails(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
  }, [emails, hydrated]);

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      setEmailError("Enter a valid email address (e.g. name@example.com)");
      return;
    }
    if (emails.includes(e)) {
      setEmailError("This email is already in the list");
      return;
    }
    setEmails((prev) => [...prev, e]);
    setNewEmail("");
    setEmailError("");
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <section className="rounded-lg border bg-card p-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Default Alert Recipients
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          These emails receive alerts from every sensor. Per-sensor recipients
          are additive — both lists are notified.
        </p>

        <div className="space-y-1.5">
          {hydrated && emails.length === 0 && (
            <p className="py-1 text-sm text-muted-foreground">
              No global recipients set.
            </p>
          )}
          {hydrated &&
            emails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <span className="truncate">{email}</span>
                <button
                  onClick={() =>
                    setEmails((prev) => prev.filter((e) => e !== email))
                  }
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${email}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

          <div className="space-y-1 pt-1">
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                placeholder="name@example.com"
                className={cn(
                  "min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
                  emailError
                    ? "border-red-400 focus:ring-red-400"
                    : "border-input",
                )}
              />
              <button
                onClick={addEmail}
                className="flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {emailError && (
              <p className="text-xs text-red-600">{emailError}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
