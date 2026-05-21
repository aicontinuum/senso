import {
  mockGateway,
  mockSensors,
  mockAlertConfigs,
  mockAlerts,
} from "@senso/mock-data";
import { SensorCard } from "@/components/dashboard/SensorCard";

export default function DashboardPage() {
  const activeAlerts = mockAlerts.filter((a) => !a.resolvedAt);
  const onlineCount = mockSensors.filter((s) => s.status === "online").length;
  const offlineCount = mockSensors.length - onlineCount;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Summary bar */}
      <div className="mb-6 flex flex-wrap items-center gap-6 rounded-lg border bg-card px-5 py-4">
        <SummaryItem label="Gateway">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span
              className={
                mockGateway.status === "online"
                  ? "size-2 rounded-full bg-green-500"
                  : "size-2 rounded-full bg-zinc-400"
              }
            />
            {mockGateway.status === "online" ? "Online" : "Offline"}
          </span>
        </SummaryItem>

        <div className="h-8 w-px bg-border" />

        <SummaryItem label="Sensors">
          <span className="text-sm font-medium">
            <span className="text-green-700">{onlineCount} online</span>
            {offlineCount > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-zinc-500">{offlineCount} offline</span>
              </>
            )}
          </span>
        </SummaryItem>

        {activeAlerts.length > 0 && (
          <>
            <div className="h-8 w-px bg-border" />
            <SummaryItem label="Active Alerts">
              <span className="text-sm font-semibold text-red-600">
                {activeAlerts.length}
              </span>
            </SummaryItem>
          </>
        )}
      </div>

      {/* Sensor grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockSensors.map((sensor) => {
          const alertConfig = mockAlertConfigs.find(
            (c) => c.sensorId === sensor.id,
          );
          const hasActiveAlert = activeAlerts.some(
            (a) => a.sensorId === sensor.id,
          );
          return (
            <SensorCard
              key={sensor.id}
              sensor={sensor}
              alertConfig={alertConfig}
              hasActiveAlert={hasActiveAlert}
            />
          );
        })}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
