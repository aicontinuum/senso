import Link from "next/link";
import { notFound } from "next/navigation";
import {
  mockAlerts,
  mockSensors,
  mockAlertConfigs,
  mockReadings,
} from "@senso/mock-data";
import { TemperatureChart } from "@/components/alerts/TemperatureChart";

const CUSTOMER_SENSOR_IDS = new Set(
  mockSensors.filter(s => s.customerId === 'customer_001').map(s => s.id),
);

export function generateStaticParams() {
  return mockAlerts
    .filter(a => CUSTOMER_SENSOR_IDS.has(a.sensorId))
    .map((a) => ({ id: a.id }));
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alert = mockAlerts.find((a) => a.id === id);
  if (!alert) notFound();

  const sensor = mockSensors.find((s) => s.id === alert.sensorId);
  const config = mockAlertConfigs.find((c) => c.sensorId === alert.sensorId);
  const alertTime = new Date(alert.triggeredAt).getTime();
  const windowStart = alertTime - 12 * 60 * 60 * 1000;
  const windowEnd = alertTime + 12 * 60 * 60 * 1000;
  const readings = (mockReadings[alert.sensorId] ?? [])
    .filter((r) => {
      const t = new Date(r.recordedAt).getTime();
      return t >= windowStart && t <= windowEnd;
    })
    .sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

  const threshold =
    alert.type === "above_max"
      ? (config?.maxTemp ?? 0)
      : (config?.minTemp ?? 0);

  const chartData = readings.map((r) => {
    const d = new Date(r.recordedAt);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const hour = String(d.getUTCHours()).padStart(2, "0");
    const minute = String(d.getUTCMinutes()).padStart(2, "0");
    return { time: `${day}/${month}, ${hour}:${minute}`, temp: r.temperature };
  });

  return (
    <div>
      <Link
        href="/alerts"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Alerts
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">
          {sensor?.name ?? alert.sensorId}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {alert.type === "above_max" ? "Too high" : "Too low"} ·{" "}
          {alert.temperature}°C · {formatDateTime(alert.triggeredAt)}
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          Temperature readings — {sensor?.name}
        </p>
        <TemperatureChart
          data={chartData}
          threshold={threshold}
          alertType={alert.type}
        />
      </div>
    </div>
  );
}
