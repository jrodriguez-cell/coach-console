"use client";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";

// MTTM Mobility theme: Ink for actuals, Fern for plan, Ink tints for the
// band and grid. No extra colours.
const C = {
  actual: "#0E0E0D",
  planned: "#5F665A",
  band: "#0E0E0D",
  grid: "rgba(14,14,13,0.10)",
  axis: "#4F5549",
  cursor: "rgba(14,14,13,0.06)",
};
const axis = { stroke: C.axis, fontSize: 11, tickLine: false, fontFamily: "var(--font-manrope)" };
const tip = {
  contentStyle: { background: "#B7C0AE", border: "1px solid rgba(14,14,13,0.35)", borderRadius: 0, color: "#EFEBE3", fontSize: 12, fontFamily: "var(--font-manrope)" },
  labelStyle: { color: "#4F5549" },
  itemStyle: { color: "#0E0E0D" },
};
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
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={tick} {...axis} />
          <YAxis domain={["auto", "auto"]} width={44} {...axis} unit="" />
          <Tooltip {...tip} formatter={(v: unknown, n) => (Array.isArray(v) ? [`${Number(v[0]).toFixed(1)}–${Number(v[1]).toFixed(1)} lb`, String(n)] : [`${Number(v).toFixed(1)} lb`, String(n)])} labelFormatter={(l) => (typeof l === "number" ? new Date(l).toISOString().slice(0, 10) : String(l))} />
          <Legend wrapperStyle={{ fontSize: 12, color: C.axis }} />
          <Area dataKey="band" name="Planned range (estimate)" stroke="none" fill={C.band} fillOpacity={0.08} connectNulls isAnimationActive={false} />
          <Line dataKey="planned" name="Planned trajectory" stroke={C.planned} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="trend" name="7-day trend" stroke={C.actual} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
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
          <Tooltip {...tip} formatter={(v: unknown) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, "Value"]} cursor={{ stroke: C.axis }} />
          <Line dataKey="value" stroke={C.actual} strokeWidth={1.5} dot={{ r: 4, fill: C.actual }} activeDot={{ r: 6 }} isAnimationActive={false} />
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
          <Tooltip {...tip} formatter={(v: unknown) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, "Volume"]} cursor={{ fill: C.cursor }} />
          <Bar dataKey="value" fill={C.actual} radius={0} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
