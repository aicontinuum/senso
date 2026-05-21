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

export default function AlertsPage() {
  const sensorMap = Object.fromEntries(
    mockSensors.map((s) => [s.id, s.name]),
  );

  const sorted = [...mockAlerts].sort(
    (a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Alerts</h1>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Sensor</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Temperature</th>
              <th className="px-4 py-3">Triggered</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((alert) => (
              <tr key={alert.id} className="border-b last:border-0">
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
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={4}
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
