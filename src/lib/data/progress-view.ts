import "server-only";
import { plannedTrajectory, trend7, weeklyVolume } from "@/lib/progress";
import type { ClientProgressData, ProgressSummary } from "./progress-data";
import type { WeightChartRow } from "@/components/charts";

/** Rows for the weight chart: weigh-ins, 7-day trend, planned trajectory and band. */
export function weightRows(d: ClientProgressData, s: ProgressSummary): WeightChartRow[] {
  const weigh = d.metrics.weight_lb ?? [];
  const tr = trend7(weigh);
  const map = new Map<string, WeightChartRow>();
  for (const w of weigh) map.set(w.date, { ...map.get(w.date), date: w.date, weight: w.value });
  for (const t of tr) map.set(t.date, { ...map.get(t.date), date: t.date, trend: Math.round(t.value * 10) / 10 });
  if (s.meta) {
    for (const p of plannedTrajectory({ startDate: s.meta.startDate, startWeight: s.meta.startWeight, plannedLbPerWeek: s.meta.plannedLbPerWeek, bandHalfWidthLbPerWeek: s.meta.bandHalfWidthLbPerWeek, weeks: s.meta.weeks })) {
      map.set(p.date, { ...map.get(p.date), date: p.date, planned: Math.round(p.planned * 10) / 10, band: [Math.round(p.low * 10) / 10, Math.round(p.high * 10) / 10] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function volumeRows(d: ClientProgressData) {
  return weeklyVolume(d.sets);
}
