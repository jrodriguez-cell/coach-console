/**
 * Energy model: calories in vs. calories out, accounting for everything the
 * plan prescribes, with honest uncertainty. Pure functions; unit-tested.
 *
 * Conventions
 *  - All component values are kcal/day averaged over a 7-day week unless the
 *    name says "per_week".
 *  - `deficit` is kcal/day below TDEE (negative = surplus).
 *  - `daily_balance` = target − TDEE (negative = deficit).
 *  - Predicted weekly change uses 3,500 kcal/lb as a planning approximation.
 *  - Post-exercise afterburn (EPOC) is ignored — a conservative choice that
 *    slightly under-counts expenditure rather than over-counting it.
 */
import {
  CM_PER_IN,
  KCAL_PER_LB,
  LB_PER_KG,
  METS,
  NEAT_FACTORS,
  TEF_FRACTION,
  UNCERTAINTY,
  MEASURED_MIN_DAYS,
  type Activity,
  type NeatLevel,
} from "@/config/energy";

export type Sex = "male" | "female";
export type BmrMethod = "mifflin" | "katch";
export type EnergyMode = "formula" | "measured";

export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const inToCm = (inches: number) => inches * CM_PER_IN;
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mifflin-St Jeor resting energy (kcal/day). */
export function mifflinStJeor(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/** Katch-McArdle resting energy (kcal/day). Requires body-fat %. */
export function katchMcArdle(p: { weightKg: number; bodyFatPct: number }): number {
  const leanKg = p.weightKg * (1 - p.bodyFatPct / 100);
  return 370 + 21.6 * leanKg;
}

export function bmr(p: { method: BmrMethod; sex: Sex; weightKg: number; heightCm: number; age: number; bodyFatPct?: number | null }): number {
  if (p.method === "katch") {
    if (p.bodyFatPct == null) throw new Error("Katch-McArdle requires body-fat %");
    return katchMcArdle({ weightKg: p.weightKg, bodyFatPct: p.bodyFatPct });
  }
  return mifflinStJeor(p);
}

/** Non-exercise activity (occupation + daily living): BMR × (factor − 1). */
export function neatKcal(bmrKcal: number, factor: number): number {
  return bmrKcal * (factor - 1);
}

export function neatFactor(level: NeatLevel): number {
  return NEAT_FACTORS[level].factor;
}

/** Net exercise energy (kcal), net of resting: (MET − 1) × kg × hours. */
export function netExerciseKcal(met: number, weightKg: number, minutes: number): number {
  return (met - 1) * weightKg * (minutes / 60);
}

export type ExerciseCategory = "strength" | "cardio" | "mobility";

export interface ExerciseLoad {
  category: ExerciseCategory;
  label: string;
  met: number;
  minutes: number;
  perWeek: number;
}

export function metFor(activity: Activity): number {
  return METS[activity].met;
}

export interface ExerciseBreakdown {
  strength_kcal_per_week: number;
  cardio_kcal_per_week: number;
  mobility_kcal_per_week: number;
  total_kcal_per_week: number;
  per_day: number;
}

export function weeklyExercise(loads: ExerciseLoad[], weightKg: number): ExerciseBreakdown {
  const sum = { strength: 0, cardio: 0, mobility: 0 };
  for (const l of loads) sum[l.category] += netExerciseKcal(l.met, weightKg, l.minutes) * l.perWeek;
  const total = sum.strength + sum.cardio + sum.mobility;
  return {
    strength_kcal_per_week: sum.strength,
    cardio_kcal_per_week: sum.cardio,
    mobility_kcal_per_week: sum.mobility,
    total_kcal_per_week: total,
    per_day: total / 7,
  };
}

/**
 * Closed-form intake with TEF: intake = (A − D) / (1 − t), where
 * A = BMR + NEAT + planned exercise, D = desired daily deficit, t = TEF fraction.
 * TDEE = A + t × intake, so TDEE − intake = D exactly.
 */
export function solveIntake(A: number, deficit: number, tef: number = TEF_FRACTION): { intake: number; tef: number; tdee: number } {
  const intake = (A - deficit) / (1 - tef);
  const tefKcal = tef * intake;
  return { intake, tef: tefKcal, tdee: A + tefKcal };
}

export interface EnergyInput {
  mode: EnergyMode;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  bmrMethod: BmrMethod;
  neatFactor: number;
  loads: ExerciseLoad[];
  /** kcal/day below TDEE; negative = surplus */
  deficit: number;
  /** If set, the trainer fixed the target instead of the deficit. */
  targetOverride?: number | null;
  tefFraction?: number;
  measured?: {
    tdee: number;
    days: number;
    /** client's CURRENT exercise already inside the measured TDEE */
    baselineLoads?: ExerciseLoad[] | null;
    /** alternative: wearable active calories/day attributable to current exercise */
    baselineActiveKcalPerDay?: number | null;
  } | null;
  /** override uncertainty (e.g. calibrated 0.05) */
  uncertaintyPct?: number | null;
}

export interface EnergyOutputs {
  mode: EnergyMode;
  bmr: number;
  nonexercise_kcal: number;
  strength_kcal_per_week: number;
  cardio_kcal_per_week: number;
  mobility_kcal_per_week: number;
  planned_exercise_kcal_per_day: number;
  baseline_exercise_kcal_per_day: number | null;
  measured_tdee: number | null;
  tef_kcal: number | null;
  tdee: number;
  target_kcal: number;
  daily_balance: number;
  predicted_lb_per_week: number;
  predicted_low: number;
  predicted_high: number;
  uncertainty_pct: number;
  /** true when measured mode lacks the client's baseline exercise (guardrail blocks) */
  baseline_missing: boolean;
  measured_window_short: boolean;
  notes: string[];
}

/** Weekly weight change (lb) from a daily balance (kcal). */
export function lbPerWeekFromBalance(dailyBalance: number): number {
  return (dailyBalance * 7) / KCAL_PER_LB;
}

export function balanceFromLbPerWeek(lbPerWeek: number): number {
  return (lbPerWeek * KCAL_PER_LB) / 7;
}

/**
 * ~80% band on the predicted weekly change. The TDEE uncertainty (fraction)
 * is treated as the band half-width in kcal/day.
 */
export function predictionBand(dailyBalance: number, tdee: number, uncertainty: number) {
  const central = lbPerWeekFromBalance(dailyBalance);
  const half = lbPerWeekFromBalance(tdee * uncertainty);
  return { central, low: central - half, high: central + half, halfWidth: half };
}

export function buildEnergyModel(input: EnergyInput): EnergyOutputs {
  const tefFraction = input.tefFraction ?? TEF_FRACTION;
  const notes: string[] = [
    "All expenditure figures are estimates. Predicted change uses 3,500 kcal per lb as a planning approximation only.",
    "Post-exercise afterburn is ignored (conservative).",
  ];
  const b = bmr({ method: input.bmrMethod, sex: input.sex, weightKg: input.weightKg, heightCm: input.heightCm, age: input.age, bodyFatPct: input.bodyFatPct });
  const neat = neatKcal(b, input.neatFactor);
  const ex = weeklyExercise(input.loads, input.weightKg);

  let tdee: number;
  let target: number;
  let tefKcal: number | null;
  let baselinePerDay: number | null = null;
  let baselineMissing = false;
  let windowShort = false;
  let measuredTdee: number | null = null;

  if (input.mode === "measured") {
    if (!input.measured) throw new Error("Measured mode requires a measured TDEE");
    measuredTdee = input.measured.tdee;
    // An explicit empty list means "client currently does no exercise" and is valid.
    if (input.measured.baselineLoads != null) {
      baselinePerDay = weeklyExercise(input.measured.baselineLoads, input.weightKg).per_day;
    } else if (input.measured.baselineActiveKcalPerDay != null) {
      baselinePerDay = input.measured.baselineActiveKcalPerDay;
    } else {
      baselineMissing = true;
    }
    windowShort = input.measured.days < MEASURED_MIN_DAYS;
    // Measured TDEE already contains current exercise and the food effect;
    // add ONLY the increase from the new program.
    tdee = input.measured.tdee + (ex.per_day - (baselinePerDay ?? 0));
    target = input.targetOverride ?? tdee - input.deficit;
    tefKcal = null;
    notes.push("Measured mode: the wearable TDEE already includes current exercise and the thermic effect of food; only the program's increase over baseline exercise is added.");
  } else {
    const A = b + neat + ex.per_day;
    if (input.targetOverride != null) {
      target = input.targetOverride;
      tefKcal = tefFraction * target;
      tdee = A + tefKcal;
    } else {
      const s = solveIntake(A, input.deficit, tefFraction);
      target = s.intake;
      tefKcal = s.tef;
      tdee = s.tdee;
    }
  }

  const uncertainty = input.uncertaintyPct ?? (input.mode === "measured" ? UNCERTAINTY.measured : UNCERTAINTY.formula);
  const balance = target - tdee;
  const band = predictionBand(balance, tdee, uncertainty);

  return {
    mode: input.mode,
    bmr: b,
    nonexercise_kcal: neat,
    strength_kcal_per_week: ex.strength_kcal_per_week,
    cardio_kcal_per_week: ex.cardio_kcal_per_week,
    mobility_kcal_per_week: ex.mobility_kcal_per_week,
    planned_exercise_kcal_per_day: ex.per_day,
    baseline_exercise_kcal_per_day: baselinePerDay,
    measured_tdee: measuredTdee,
    tef_kcal: tefKcal,
    tdee,
    target_kcal: target,
    daily_balance: balance,
    predicted_lb_per_week: band.central,
    predicted_low: band.low,
    predicted_high: band.high,
    uncertainty_pct: uncertainty,
    baseline_missing: baselineMissing,
    measured_window_short: windowShort,
    notes,
  };
}

/** Human-readable prediction, e.g. "−1.5 lb/week, likely between −0.9 and −2.1". */
export function describePrediction(o: Pick<EnergyOutputs, "predicted_lb_per_week" | "predicted_low" | "predicted_high">): string {
  const f = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(round1(n)).toFixed(1)}`;
  return `${f(o.predicted_lb_per_week)} lb/week (estimate), likely between ${f(o.predicted_high)} and ${f(o.predicted_low)}`;
}
