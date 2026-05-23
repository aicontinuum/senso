import Link from "next/link";
import {
  mockGateway,
  mockSensors,
  mockAlertConfigs,
  mockAlerts,
} from "@senso/mock-data";
import { SensorCard } from "@/components/dashboard/SensorCard";
import { Plus } from "lucide-react";

const CUSTOMER_ID = 'customer_001';

export default function DashboardPage() {
  const MOCK_NOW = new Date("2025-05-22T03:00:00.000Z").getTime();
  const cutoff = MOCK_NOW - 24 * 60 * 60 * 1000;
  const customerSensors = mockSensors.filter((s) => s.customerId === CUSTOMER_ID);
  const customerSensorIds = new Set(customerSensors.map((s) => s.id));
  const recentAlerts = mockAlerts.filter(
    (a) => new Date(a.triggeredAt).getTime() >= cutoff && customerSensorIds.has(a.sensorId),
  );
  const onlineCount = customerSensors.filter((s) => s.status === "online").length;
  const offlineCount = customerSensors.length - onlineCount;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/setup"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          title="Add sensor or gateway"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Device</span>
        </Link>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-3 divide-x rounded-lg border bg-card">
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

        <SummaryItem label="Alerts (past 24h)">
          {recentAlerts.length > 0 ? (
            <span className="text-sm font-medium text-red-600">
              {recentAlerts.length} alert{recentAlerts.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-sm font-medium text-green-700">None</span>
          )}
        </SummaryItem>
      </div>

      {/* Sensor grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {customerSensors.map((sensor) => {
          const alertConfig = mockAlertConfigs.find(
            (c) => c.sensorId === sensor.id,
          );
          const hasActiveAlert = recentAlerts.some(
            (a) => a.sensorId === sensor.id && !a.resolvedAt,
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
    <div className="flex flex-col gap-0.5 px-4 py-4 sm:px-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
