"use client";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";

// Reference data-viz palette (light): series-1 blue for actuals, neutral slate for plan/band.
const C = {
  actual: "#2a78d6",
  planned: "#52514e",
  band: "#d4d4d0",
  grid: "#e7e5e4",
  axis: "#78716c",
};
const axis = { stroke: C.axis, fontSize: 11, tickLine: false };
const short = (d: string) => {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
};

export interface WeightChartRow {
  date: string;
  weight?: number | null;
  trend?: number | null;
  planned?: number | null;
  band?: [number, number] | null;
}

export function WeightChart({ rows }: { rows: WeightChartRow[] }) {
  if (!rows.length) return <p className="muted">No data yet.</p>;
  // Real time axis: dates → epoch ms so spacing reflects elapsed days.
  const data = rows.map((r) => ({ ...r, t: Date.parse(`${r.date}T00:00:00Z`) }));
  const tick = (t: number) => short(new Date(t).toISOString().slice(0, 10));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={tick} {...axis} />
          <YAxis domain={["auto", "auto"]} width={44} {...axis} unit="" />
          <Tooltip formatter={(v: unknown, n) => (Array.isArray(v) ? [`${Number(v[0]).toFixed(1)}–${Number(v[1]).toFixed(1)} lb`, String(n)] : [`${Number(v).toFixed(1)} lb`, String(n)])} labelFormatter={(l) => (typeof l === "number" ? new Date(l).toISOString().slice(0, 10) : String(l))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area dataKey="band" name="Planned range (estimate)" stroke="none" fill={C.band} fillOpacity={0.6} connectNulls isAnimationActive={false} />
          <Line dataKey="planned" name="Planned trajectory" stroke={C.planned} strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="trend" name="7-day trend" stroke={C.actual} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          <Scatter dataKey="weight" name="Weigh-in" fill={C.actual} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeriesChart({ points, unit, height = 160, domain }: { points: { date: string; value: number }[]; unit?: string | null; height?: number; domain?: [number, number] }) {
  if (!points.length) return <p className="muted">No entries.</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} {...axis} />
          <YAxis domain={domain ?? ["auto", "auto"]} width={44} {...axis} />
          <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, "Value"]} />
          <Line dataKey="value" stroke={C.actual} strokeWidth={2} dot={{ r: 4, fill: C.actual }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarSeries({ points, unit, height = 160 }: { points: { date: string; value: number }[]; unit?: string; height?: number }) {
  if (!points.length) return <p className="muted">No entries.</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} {...axis} />
          <YAxis width={52} {...axis} />
          <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, "Volume"]} cursor={{ fill: "#f5f5f4" }} />
          <Bar dataKey="value" fill={C.actual} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
