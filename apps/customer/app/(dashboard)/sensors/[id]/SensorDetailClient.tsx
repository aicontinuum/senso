"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Plus, Pencil } from "lucide-react";
import type { Sensor, AlertConfig, Gateway, Reading } from "@senso/types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  isOutOfRange,
  formatTemp,
  formatThreshold,
  formatReadingTime,
} from "@/lib/temperature";

interface Props {
  sensor: Sensor;
  config: AlertConfig;
  gateway: Gateway;
  accountRecipients: string[];
  recentReadings: Reading[];
}

export function SensorDetailClient({ sensor, config, gateway, accountRecipients, recentReadings }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sensor.name);
  const [minTemp, setMinTemp] = useState(String(config.minTemp));
  const [maxTemp, setMaxTemp] = useState(String(config.maxTemp));
  const [emails, setEmails] = useState<string[]>(config.emailRecipients);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const temp = sensor.lastReading?.temperature;
  const isOffline = sensor.status === "offline";
  const outOfRange =
    !isOffline &&
    temp !== undefined &&
    isOutOfRange(temp, Number(minTemp), Number(maxTemp));

  // Y-axis domain that always includes both threshold lines, padded so they sit on-screen
  const chartTemps = recentReadings.map((r) => r.temperature);
  const chartLo = Math.min(config.minTemp, ...chartTemps);
  const chartHi = Math.max(config.maxTemp, ...chartTemps);
  const chartPad = Math.max(1, (chartHi - chartLo) * 0.1);
  const chartDomain: [number, number] = [
    Math.floor(chartLo - chartPad),
    Math.ceil(chartHi + chartPad),
  ];

  function startEditing() {
    setEditing(true);
    setSaved(false);
  }

  function cancelEditing() {
    setName(sensor.name);
    setMinTemp(String(config.minTemp));
    setMaxTemp(String(config.maxTemp));
    setEmails(config.emailRecipients);
    setNewEmail("");
    setEmailError("");
    setSaveError("");
    setEditing(false);
  }

  async function handleSave() {
    setSaveError('');
    const min = Number(minTemp);
    const max = Number(maxTemp);
    if (isNaN(min) || isNaN(max)) { setSaveError('Thresholds must be numbers'); return; }
    if (min >= max) { setSaveError('Min must be less than max'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/sensors/${sensor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minTemp: min, maxTemp: max, emailRecipients: emails }),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) { setSaveError(data.error ?? `Error ${res.status}`); return; }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch {
      setSaveError('Unexpected error — check console');
    } finally {
      setSaving(false);
    }
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

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
    if (accountRecipients.includes(e)) {
      setEmailError(
        "This email already receives alerts via account-wide settings",
      );
      return;
    }
    setEmails((prev) => [...prev, e]);
    setNewEmail("");
    setEmailError("");
  }

  const battery = sensor.batteryLevel;
  const batteryColor =
    battery === undefined
      ? "bg-zinc-300"
      : battery <= 20
        ? "bg-red-500"
        : battery <= 40
          ? "bg-amber-400"
          : "bg-green-500";

  return (
    <div className="max-w-lg">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <div className="mt-4 mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{name}</h1>
        {isOffline ? (
          <Badge variant="secondary" className="shrink-0 gap-1.5">
            <span className="size-1.5 rounded-full bg-zinc-400" />
            Offline
          </Badge>
        ) : outOfRange ? (
          <Badge className="shrink-0 gap-1.5 bg-red-100 text-red-700 hover:bg-red-100">
            <span className="size-1.5 rounded-full bg-red-500" />
            Alert
          </Badge>
        ) : (
          <Badge className="shrink-0 gap-1.5 bg-green-50 text-green-700 hover:bg-green-50">
            <span className="size-1.5 rounded-full bg-green-500" />
            Online
          </Badge>
        )}
      </div>

      {/* Current reading */}
      <section className="mb-4 rounded-lg border bg-card p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Current Reading
        </p>
        <div className="text-center">
          <span
            className={cn(
              "text-4xl font-bold tabular-nums",
              isOffline && "text-muted-foreground",
              outOfRange && "text-red-600",
            )}
          >
            {temp !== undefined ? formatTemp(temp) : "—"}
          </span>
          <p
            className={cn(
              "mt-1 text-xs font-medium uppercase tracking-wide",
              isOffline
                ? "text-muted-foreground"
                : outOfRange
                  ? "font-semibold text-red-600"
                  : "text-green-700",
            )}
          >
            {isOffline ? "Offline" : outOfRange ? "Out of range" : "In range"}
          </p>
        </div>
      </section>

      {/* Recent readings chart */}
      {recentReadings.length >= 2 && (
        <section className="mb-4 rounded-lg border bg-card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent Readings
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={recentReadings} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="recordedAt" tickFormatter={(t: string) => formatReadingTime(t).split(",")[1]?.trim() ?? ""} tick={{ fontSize: 11 }} />
              <YAxis domain={chartDomain} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatTemp(Number(v))} labelFormatter={(l) => formatReadingTime(String(l))} />
              <ReferenceLine y={config.minTemp} stroke="var(--primary)" strokeDasharray="4 2" />
              <ReferenceLine y={config.maxTemp} stroke="var(--primary)" strokeDasharray="4 2" />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke={outOfRange ? "#dc2626" : "var(--primary)"}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Settings */}
      <section className="mb-4 rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Settings
          </p>
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : (
            <button
              onClick={cancelEditing}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="space-y-5">
          {/* Name — read-only, set by admin */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Sensor Name
            </p>
            <p className="text-sm font-medium">{name}</p>
          </div>

          {/* Thresholds */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Temperature Threshold
            </p>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Min (°C)</p>
                  <input
                    type="number"
                    value={minTemp}
                    onChange={(e) => setMinTemp(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Max (°C)</p>
                  <input
                    type="number"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium">
                {formatThreshold(Number(minTemp), Number(maxTemp))}
              </p>
            )}
          </div>

          {/* Account-wide recipients (read-only) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Account-wide Recipients
              </p>
              <Link
                href="/settings"
                className="text-xs text-muted-foreground hover:underline underline-offset-2"
              >
                Manage in Settings →
              </Link>
            </div>
            {accountRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">None set</p>
            ) : (
              <div className="space-y-1">
                {accountRecipients.map((email) => (
                  <p key={email} className="text-sm font-medium">
                    {email}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Per-sensor email recipients */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Alert Recipients
            </p>
            {editing ? (
              <div className="space-y-1.5">
                {emails.map((email) => (
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
                <div className="space-y-1">
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
                        emailError ? "border-red-400 focus:ring-red-400" : "border-input",
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
            ) : (
              <div className="space-y-1">
                {emails.map((email) => (
                  <p key={email} className="text-sm font-medium">
                    {email}
                  </p>
                ))}
              </div>
            )}
          </div>

          {editing && (
            <div className="space-y-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saveError && <p className="text-center text-xs text-red-600">{saveError}</p>}
            </div>
          )}

          {saved && !editing && (
            <p className="text-center text-xs font-medium text-green-700">
              ✓ Changes saved
            </p>
          )}
        </div>
      </section>

      {/* Device info */}
      <section className="rounded-lg border bg-card p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Device Info
        </p>
        <div className="space-y-2 text-sm">
          <InfoRow label="Gateway">{gateway.name}</InfoRow>
          {sensor.lastReading && (
            <InfoRow label={isOffline ? "Last seen" : "Last reading"}>
              {formatReadingTime(sensor.lastReading.recordedAt)}
            </InfoRow>
          )}
          {battery !== undefined && (
            <InfoRow label="Battery">
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", batteryColor)}
                    style={{ width: `${battery}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "tabular-nums",
                    battery <= 20 && "font-semibold text-red-600",
                  )}
                >
                  {battery}%
                </span>
              </div>
            </InfoRow>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
