"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONES } from "@/lib/timezones";

export function TimezoneSection({ initialTimezone }: { initialTimezone: string }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function onChange(next: string) {
    const previous = timezone;
    setTimezone(next);
    setSaved(false);
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTimezone(previous);
        setError(data.error ?? "Failed to save");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Timezone
      </p>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          All timestamps and reports are shown in this timezone.
        </p>
        <select
          value={timezone}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-alert-text">{error}</p>}
        {saved && <p className="text-xs font-medium text-ok-text">✓ Saved</p>}
      </div>
    </section>
  );
}
