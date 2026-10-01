/**
 * Checkpoint calibration: compare the observed rate of weight change with
 * the plan, and recommend keep / adjust / fix adherence. The trainer approves
 * or edits every adjustment.
 */
import { CALIBRATION, KCAL_PER_LB, UNCERTAINTY } from "@/config/energy";
import { daysBetween } from "./dates";

export type CalibrationDecision = "keep" | "adjust" | "fix_adherence" | "insufficient_data";

export interface WeighIn {
  date: string; // YYYY-MM-DD
  weight: number;
}

export interface CalibrationInput {
  planStartDate: string;
  periodStart: string;
  periodEnd: string;
  weighIns: WeighIn[];
  /** planned lb/week (negative = loss) */
  plannedLbPerWeek: number;
  /** planned band (lb/week); defaults to planned ± 0.25 */
  plannedBand?: { low: number; high: number } | null;
  adherencePct: number | null;
  currentTargetKcal: number;
  minCalories?: number;
  maxAdjustmentKcal?: number;
}

export interface CalibrationResult {
  decision: CalibrationDecision;
  weigh_in_points: number;
  span_days: number;
  observed_lb_per_week: number | null;
  planned_lb_per_week: number;
  adherence_pct: number | null;
  implied_daily_balance: number | null;
  recommended_adjustment_kcal: number;
  recommended_target_kcal: number;
  /** uncertainty to use after a successful calibration */
  new_uncertainty_pct: number | null;
  explanation: string;
}

/** Least-squares slope of weight vs. time, in lb per week. */
export function slopeLbPerWeek(points: WeighIn[]): number {
  const t0 = points[0].date;
  const xs = points.map((p) => daysBetween(t0, p.date));
  const ys = points.map((p) => p.weight);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : (num / den) * 7;
}

/** Keep only weigh-ins usable for calibration (inside the period, after weeks 1–2). */
export function usableWeighIns(input: Pick<CalibrationInput, "planStartDate" | "periodStart" | "periodEnd" | "weighIns">): WeighIn[] {
  return input.weighIns
    .filter((w) => daysBetween(input.planStartDate, w.date) >= CALIBRATION.excludeFirstDays)
    .filter((w) => w.date >= input.periodStart && w.date <= input.periodEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calibrate(input: CalibrationInput): CalibrationResult {
  const points = usableWeighIns(input);
  const span = points.length >= 2 ? daysBetween(points[0].date, points[points.length - 1].date) : 0;
  const base = {
    weigh_in_points: points.length,
    span_days: span,
    planned_lb_per_week: input.plannedLbPerWeek,
    adherence_pct: input.adherencePct,
    recommended_adjustment_kcal: 0,
    recommended_target_kcal: input.currentTargetKcal,
  };

  if (points.length < CALIBRATION.minPoints || span < CALIBRATION.minSpanDays) {
    return {
      ...base,
      decision: "insufficient_data",
      observed_lb_per_week: points.length >= 2 ? slopeLbPerWeek(points) : null,
      implied_daily_balance: null,
      new_uncertainty_pct: null,
      explanation: `Need at least ${CALIBRATION.minPoints} weigh-ins across ${CALIBRATION.minSpanDays}+ days (weeks 1–2 excluded); have ${points.length} across ${span} days. Keep the current target and collect more weigh-ins.`,
    };
  }

  const observed = slopeLbPerWeek(points);
  const implied = (observed * KCAL_PER_LB) / 7;

  if (input.adherencePct != null && input.adherencePct < CALIBRATION.adherenceThresholdPct) {
    return {
      ...base,
      decision: "fix_adherence",
      observed_lb_per_week: observed,
      implied_daily_balance: implied,
      new_uncertainty_pct: null,
      explanation: `Adherence is ${Math.round(input.adherencePct)}% (below ${CALIBRATION.adherenceThresholdPct}%). Do not change calories — work on adherence first; the observed rate doesn't reflect the plan.`,
    };
  }

  const band = input.plannedBand ?? { low: input.plannedLbPerWeek - 0.25, high: input.plannedLbPerWeek + 0.25 };
  const lo = Math.min(band.low, band.high);
  const hi = Math.max(band.low, band.high);

  if (observed >= lo && observed <= hi) {
    return {
      ...base,
      decision: "keep",
      observed_lb_per_week: observed,
      implied_daily_balance: implied,
      new_uncertainty_pct: UNCERTAINTY.calibrated,
      explanation: `Observed ${observed.toFixed(2)} lb/week is inside the planned band (${lo.toFixed(2)} to ${hi.toFixed(2)}). Keep the current target.`,
    };
  }

  // Gap in lb/week → kcal/day; a positive gap means gaining more / losing less
  // than planned, so intake should come down.
  const gapLb = observed - input.plannedLbPerWeek;
  const rawAdj = -(gapLb * KCAL_PER_LB) / 7;
  const cap = input.maxAdjustmentKcal ?? CALIBRATION.maxAdjustmentKcal;
  let adj = Math.max(-cap, Math.min(cap, rawAdj));
  const floor = input.minCalories ?? 1200;
  if (input.currentTargetKcal + adj < floor) adj = Math.min(0, floor - input.currentTargetKcal);
  adj = Math.round(adj);

  return {
    ...base,
    decision: "adjust",
    observed_lb_per_week: observed,
    implied_daily_balance: implied,
    recommended_adjustment_kcal: adj,
    recommended_target_kcal: input.currentTargetKcal + adj,
    new_uncertainty_pct: UNCERTAINTY.calibrated,
    explanation: `Observed ${observed.toFixed(2)} lb/week vs. planned ${input.plannedLbPerWeek.toFixed(2)} (band ${lo.toFixed(2)} to ${hi.toFixed(2)}). The gap is about ${Math.round(Math.abs(rawAdj))} kcal/day; recommending ${adj > 0 ? "+" : ""}${adj} kcal/day (capped at ±${cap} per checkpoint and re-checked against every guardrail).`,
  };
}

/**
 * Adherence % from daily entries: days within the calorie tolerance AND with
 * protein at or above the minimum, divided by days logged. Returns null when
 * no daily calorie data exist (caller falls back to weekly adherence_pct).
 */
export function adherenceFromDaily(
  days: { date: string; calories: number | null; protein_g: number | null }[],
  target: { calories: number; calorieTol: number; proteinMin: number },
): number | null {
  const logged = days.filter((d) => d.calories != null);
  if (logged.length === 0) return null;
  const onTarget = logged.filter(
    (d) => Math.abs((d.calories as number) - target.calories) <= target.calorieTol && d.protein_g != null && d.protein_g >= target.proteinMin,
  ).length;
  return (onTarget / logged.length) * 100;
}

export function averageWeeklyAdherence(entries: { value: number }[]): number | null {
  if (entries.length === 0) return null;
  return entries.reduce((a, e) => a + e.value, 0) / entries.length;
}
