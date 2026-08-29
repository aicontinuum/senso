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
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import type { AlertType } from "@senso/types";
import { formatTemp } from "@/lib/temperature";

interface ChartPoint {
  time: string;
  temp: number;
}

interface Props {
  data: ChartPoint[];
  /** Both bounds, so the chart shows the whole safe range and not only the
   *  edge that happened to fire. */
  minTemp: number;
  maxTemp: number;
  /** Which bound this alert breached — that one is drawn in the alert tone. */
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
      <text textAnchor="middle" fill="var(--text-faint)" fontSize={10}>
        <tspan x="0" dy="0.9em">{time}</tspan>
        <tspan x="0" dy="1.3em">{date}</tspan>
      </text>
    </g>
  );
}

export function TemperatureChart({ data, minTemp, maxTemp, alertType }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[300px]" />;
  const temps = data.map((d) => d.temp);
  // Both bounds join the domain, or a threshold outside the readings would sit
  // off-chart and look as though it were missing.
  const allValues = [...temps, minTemp, maxTemp];
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
        {/* Horizontal hairlines only — no vertical grid, no chart border. */}
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="time"
          tick={<TwoLineTick />}
          tickLine={false}
          interval={Math.ceil((data.length - 1) / 5)}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 11, fill: "var(--text-faint)", fontFamily: "var(--font-mono)" }}
          tickLine={false}
          width={36}
        />
        <Tooltip
          formatter={(v) => [formatTemp(Number(v)), "Temperature"]}
          contentStyle={{ fontSize: 12 }}
        />
        {/* The safe range: the design system's one sanctioned green tint, with
            dashed edges. Drawn first so the reading line sits over it. */}
        <ReferenceArea
          y1={minTemp}
          y2={maxTemp}
          fill="var(--ok-500)"
          fillOpacity={0.07}
          stroke="none"
        />
        {(["min", "max"] as const).map((bound) => {
          const value = bound === "min" ? minTemp : maxTemp;
          // The bound this alert breached is the one worth pointing at; the
          // other is context.
          const breached = alertType === bound;
          return (
            <ReferenceLine
              key={bound}
              y={value}
              stroke={breached ? "var(--alert-500)" : "var(--ok-500)"}
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `${bound === "max" ? "Max" : "Min"}: ${formatTemp(value)}`,
                position: "insideLeft",
                fill: breached ? "var(--alert-text)" : "var(--ok-text)",
                fontSize: 11,
                dx: 4,
                dy: bound === "max" ? -8 : 12,
              }}
            />
          );
        })}
        <Line
          type="monotone"
          dataKey="temp"
          stroke="var(--brand-500)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--brand-500)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
