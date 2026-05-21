"use client";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { AlertType } from "@senso/types";

interface ChartPoint {
  time: string;
  temp: number;
}

interface Props {
  data: ChartPoint[];
  threshold: number;
  alertType: AlertType;
}

export function TemperatureChart({ data, threshold, alertType }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[280px]" />;
  const thresholdLabel =
    alertType === "above_max" ? `Max: ${threshold}°C` : `Min: ${threshold}°C`;

  const temps = data.map((d) => d.temp);
  const allValues = [...temps, threshold];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = Math.max((max - min) * 0.2, 1);
  const domain: [number, number] = [
    Math.round((min - padding) * 10) / 10,
    Math.round((max + padding) * 10) / 10,
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 40, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          tickFormatter={(v) => `${v}°`}
          width={36}
        />
        <Tooltip
          formatter={(v) => [`${v}°C`, "Temperature"]}
          contentStyle={{ fontSize: 12 }}
        />
        <ReferenceLine
          y={threshold}
          stroke="#ef4444"
          strokeDasharray="5 3"
          strokeWidth={1.5}
          label={{
            value: thresholdLabel,
            position: "right",
            fill: "#ef4444",
            fontSize: 11,
          }}
        />
        <Line
          type="monotone"
          dataKey="temp"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
