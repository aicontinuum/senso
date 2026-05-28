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

function TwoLineTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  if (!payload || x === undefined || y === undefined) return null;
  // format is "21/05, 14:30" — split into time (first) and date (second)
  const [date, time] = payload.value.split(", ");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#6b7280" fontSize={10}>
        <tspan x="0" dy="0.9em">{time}</tspan>
        <tspan x="0" dy="1.3em">{date}</tspan>
      </text>
    </g>
  );
}

export function TemperatureChart({ data, threshold, alertType }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[300px]" />;
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
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 52, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="time"
          tick={<TwoLineTick />}
          tickLine={false}
          interval={Math.ceil((data.length - 1) / 5)}
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
            position: "insideLeft",
            fill: "#ef4444",
            fontSize: 11,
            dx: 4,
            dy: -8,
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
