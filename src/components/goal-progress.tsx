"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import clsx from "clsx";
import type { GoalOverview } from "@/lib/goal-progress";

// Brand marks: Ink for the client's actuals, Fern for plan/targets and the
// second series. Every series is also named in a legend or direct label.
const INK = "#0E0E0D";
const FERN = "#5F665A";
const axis = { stroke: "#4F5549", fontSize: 11, tickLine: false, fontFamily: "var(--font-manrope)" };
const grid = "rgba(14,14,13,0.10)";
const tip = {
  contentStyle: { background: "#B7C0AE", border: "1px solid rgba(14,14,13,0.35)", borderRadius: 0, fontSize: 12, fontFamily: "var(--font-manrope)" },
  labelStyle: { color: "#4F5549" },
  itemStyle: { color: INK },
  cursor: { fill: "rgba(14,14,13,0.06)", stroke: "rgba(14,14,13,0.25)" },
};
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

const STATUS_ICON: Record<GoalOverview["status"], string> = { achieved: "★", ahead: "↑", on_track: "✓", behind: "!", no_data: "·" };

function Meter({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="caps">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{pct(value)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-fg/10" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
        {value != null && <div className="h-full bg-fg" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />}
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

/** Progress toward the goal, with training and nutrition adherence alongside. */
export function GoalProgress({ g }: { g: GoalOverview }) {
  const bar = g.pct != null ? Math.min(100, g.pct) : 0;
  const hasNutrition = g.weekly.some((w) => w.nutrition != null);
  const weekly = g.weekly.map((w) => ({ name: `W${w.week}`, Training: w.training != null ? Math.round(w.training) : null, Nutrition: w.nutrition != null ? Math.round(w.nutrition) : null }));
  const series = g.series.map((p) => ({ name: `W${p.week}`, Actual: p.value, Planned: p.planned }));
  const goalLabel = g.kind === "weight" ? "Weekly average weight" : g.kind === "skill" ? "Highest step reached" : g.kind === "benchmark" ? "Results" : "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr]">
        {/* Goal headline */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{g.title}</span>
            <span className={clsx("inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-semibold", g.status === "behind" ? "border-fg bg-fg text-canvas" : "border-fg/40")}>
              <span aria-hidden>{STATUS_ICON[g.status]}</span>{g.statusLabel}
            </span>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-5xl font-semibold leading-none tracking-tight tabular-nums">{g.pct != null ? Math.round(g.pct) : "—"}<span className="text-2xl">{g.pct != null ? "%" : ""}</span></span>
            <span className="pb-1 text-sm text-muted">of the way to goal</span>
          </div>
          <div className="relative mt-3 h-3 w-full bg-fg/10" role="progressbar" aria-label="Progress to goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.pct != null ? Math.round(g.pct) : undefined}>
            <div className="h-full bg-fg" style={{ width: `${bar}%` }} />
            {g.expectedPct != null && (
              <div className="absolute -top-1 bottom-[-4px] w-0.5 bg-muted" style={{ left: `calc(${Math.min(100, g.expectedPct)}% - 1px)` }} title={`Pace: ${Math.round(g.expectedPct)}% by now`} />
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted">
            <span>{g.detail}</span>
            {g.expectedPct != null && <span>│ pace marker: {Math.round(g.expectedPct)}% by week {g.currentWeek}</span>}
          </div>
        </div>
        {/* Inputs that drive it */}
        <div className="grid grid-cols-1 gap-4">
          <Meter label="Training" value={g.training.pct} detail={g.training.detail} />
          <Meter label="Nutrition" value={g.nutrition.pct} detail={g.nutrition.detail} />
          <Meter label="Overall adherence" value={g.overall} detail="Training and nutrition combined, last 14 days" />
        </div>
      </div>

      {(weekly.length > 0 || series.length > 0) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {weekly.length > 0 && (
            <figure>
              <figcaption className="caps mb-2">Weekly adherence (%)</figcaption>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} barGap={2} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="name" {...axis} />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} />
                    <Tooltip {...tip} formatter={(v: unknown, n) => [v == null ? "—" : `${v}%`, String(n)]} />
                    {hasNutrition && <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />}
                    <Bar dataKey="Training" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                    {hasNutrition && <Bar dataKey="Nutrition" fill={FERN} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!hasNutrition && <p className="text-xs text-muted">Workouts done ÷ planned each week. Nutrition joins this chart once daily food logs come in.</p>}
            </figure>
          )}
          {series.length > 0 && (
            <figure>
              <figcaption className="caps mb-2">{goalLabel}</figcaption>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="name" {...axis} />
                    {g.kind === "skill" ? (
                      <YAxis domain={[0, g.steps!.length]} ticks={g.steps!.map((_, i) => i + 1)} allowDecimals={false} {...axis} />
                    ) : (
                      <YAxis domain={["auto", "auto"]} {...axis} />
                    )}
                    <Tooltip
                      {...tip}
                      formatter={(v: unknown, n) => (g.kind === "skill" && n === "Actual" && typeof v === "number" ? [`Step ${v}: ${g.steps![v - 1]}`, "Reached"] : [v == null ? "—" : `${v}${g.unit && g.unit !== "step" ? ` ${g.unit}` : ""}`, n === "Planned" ? (g.kind === "weight" ? "Planned" : "Target") : "Actual"])}
                    />
                    {g.kind === "weight" ? (
                      <Line dataKey="Planned" name="Planned" stroke={FERN} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                    ) : (
                      <ReferenceLine y={g.series[0]?.planned ?? undefined} stroke={FERN} strokeDasharray="5 4" label={{ value: g.kind === "skill" ? "Goal" : "Target", position: "insideTopRight", fill: "#4F5549", fontSize: 11 }} />
                    )}
                    <Line dataKey="Actual" name="Actual" type={g.kind === "skill" ? "stepAfter" : "monotone"} stroke={INK} strokeWidth={2} dot={{ r: 4, fill: INK, stroke: "#B7C0AE", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted">
                {g.kind === "weight" ? "Solid: client's weekly average · dashed: planned trajectory (estimate)." : g.kind === "skill" ? `Steps: ${g.steps!.map((s, i) => `${i + 1} ${s.replace(/ \(.*\)$/, "")}`).join(" · ")}` : "Solid: results · dashed: target."}
              </p>
            </figure>
          )}
        </div>
      )}
    </div>
  );
}
