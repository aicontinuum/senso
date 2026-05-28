import Link from "next/link";
import { mockAlerts, mockSensors } from "@senso/mock-data";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CUSTOMER_ID = 'customer_001';

export default function AlertsPage() {
  const customerSensorIds = new Set(
    mockSensors.filter(s => s.customerId === CUSTOMER_ID).map(s => s.id),
  );
  const sensorMap = Object.fromEntries(
    mockSensors.filter(s => s.customerId === CUSTOMER_ID).map((s) => [s.id, s.name]),
  );

  const sorted = [...mockAlerts].filter(a => customerSensorIds.has(a.sensorId)).sort(
    (a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Alerts</h1>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Sensor</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Temperature</th>
              <th className="px-4 py-3">Triggered</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((alert) => (
              <tr key={alert.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">
                  {sensorMap[alert.sensorId] ?? alert.sensorId}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {alert.type === "above_max" ? "Too high" : "Too low"}
                </td>
                <td className="px-4 py-3 font-mono">{alert.temperature}°C</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(alert.triggeredAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/alerts/${alert.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    →
                  </Link>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No alerts recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
