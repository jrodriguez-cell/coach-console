import { describe, expect, it } from "vitest";
import {
  buildEnergyModel,
  describePrediction,
  katchMcArdle,
  mifflinStJeor,
  netExerciseKcal,
  predictionBand,
  round1,
  solveIntake,
  weeklyExercise,
  type ExerciseLoad,
} from "./energy";

const KG = 122.47; // 270 lb
const CLIENT = { sex: "male" as const, age: 36, heightCm: 190.5, weightKg: KG };

const PROGRAM: ExerciseLoad[] = [
  { category: "cardio", label: "Brisk walk", met: 4.3, minutes: 30, perWeek: 3 },
  { category: "strength", label: "Lift", met: 3.5, minutes: 55, perWeek: 4 },
  { category: "mobility", label: "Mobility", met: 2.3, minutes: 18, perWeek: 2 },
];

describe("resting energy", () => {
  it("Mifflin-St Jeor, male 36 y, 190.5 cm, 122.47 kg → 2,240.3", () => {
    expect(round1(mifflinStJeor(CLIENT))).toBe(2240.3);
  });
  it("Mifflin-St Jeor female subtracts 161", () => {
    expect(mifflinStJeor({ ...CLIENT, sex: "female" }) - mifflinStJeor(CLIENT)).toBeCloseTo(-166, 6);
  });
  it("Katch-McArdle at 31.5% body fat (lean 83.89 kg) → 2,182.1", () => {
    expect(round1(katchMcArdle({ weightKg: KG, bodyFatPct: 31.5 }))).toBe(2182.1);
  });
});

describe("net exercise energy", () => {
  it("walking MET 4.3 × 30 min = 202.1", () => expect(round1(netExerciseKcal(4.3, KG, 30))).toBe(202.1));
  it("resistance MET 3.5 × 55 min = 280.7", () => expect(round1(netExerciseKcal(3.5, KG, 55))).toBe(280.7));
  it("mobility MET 2.3 × 18 min = 47.8", () => expect(round1(netExerciseKcal(2.3, KG, 18))).toBe(47.8));
  it("scales with body weight", () => {
    expect(netExerciseKcal(4.3, 100, 30) / netExerciseKcal(4.3, 50, 30)).toBeCloseTo(2, 10);
  });
});

describe("closed-form intake with TEF", () => {
  it("BMR×1.2 + 3 walks + 4 lifts + 2 mobility, TEF 10%, deficit 500", () => {
    const bmr = mifflinStJeor(CLIENT);
    const ex = weeklyExercise(PROGRAM, KG);
    const A = bmr * 1.2 + ex.per_day;
    expect(round1(A)).toBe(2949.0);
    const s = solveIntake(A, 500, 0.1);
    expect(round1(s.intake)).toBe(2721.1);
    expect(round1(s.tdee)).toBe(3221.1);
    expect(s.tdee - s.intake).toBeCloseTo(500, 9);
  });

  it("buildEnergyModel (formula) reproduces the same numbers and breakdown", () => {
    const m = buildEnergyModel({ mode: "formula", ...CLIENT, bmrMethod: "mifflin", neatFactor: 1.2, loads: PROGRAM, deficit: 500 });
    expect(round1(m.bmr)).toBe(2240.3);
    expect(round1(m.nonexercise_kcal)).toBe(448.1);
    expect(round1(m.target_kcal)).toBe(2721.1);
    expect(round1(m.tdee)).toBe(3221.1);
    expect(m.daily_balance).toBeCloseTo(-500, 9);
    expect(m.predicted_lb_per_week).toBeCloseTo(-1, 9);
    // components sum to TDEE
    const sum = m.bmr + m.nonexercise_kcal + m.planned_exercise_kcal_per_day + (m.tef_kcal ?? 0);
    expect(sum).toBeCloseTo(m.tdee, 9);
    expect(m.uncertainty_pct).toBe(0.1);
    expect(m.predicted_low).toBeLessThan(m.predicted_lb_per_week);
    expect(m.predicted_high).toBeGreaterThan(m.predicted_lb_per_week);
  });

  it("surplus (negative deficit) increases intake", () => {
    const m = buildEnergyModel({ mode: "formula", ...CLIENT, bmrMethod: "mifflin", neatFactor: 1.2, loads: PROGRAM, deficit: -300 });
    expect(m.target_kcal - m.tdee).toBeCloseTo(300, 9);
    expect(m.predicted_lb_per_week).toBeGreaterThan(0);
  });

  it("target override keeps TDEE consistent with TEF of the actual intake", () => {
    const m = buildEnergyModel({ mode: "formula", ...CLIENT, bmrMethod: "mifflin", neatFactor: 1.2, loads: PROGRAM, deficit: 0, targetOverride: 2200 });
    expect(m.target_kcal).toBe(2200);
    expect(m.tef_kcal).toBeCloseTo(220, 9);
  });
});

describe("measured mode", () => {
  it("measured TDEE 2,926 without baseline exercise is flagged (guardrail blocks)", () => {
    const m = buildEnergyModel({ mode: "measured", ...CLIENT, bmrMethod: "mifflin", neatFactor: 1.2, loads: PROGRAM, deficit: 500, measured: { tdee: 2926, days: 21 } });
    expect(m.baseline_missing).toBe(true);
  });
  it("adds only the program increase over baseline", () => {
    const baseline: ExerciseLoad[] = [{ category: "cardio", label: "Current walks", met: 4.3, minutes: 30, perWeek: 3 }];
    const m = buildEnergyModel({ mode: "measured", ...CLIENT, bmrMethod: "mifflin", neatFactor: 1.2, loads: PROGRAM, deficit: 500, measured: { tdee: 2926, days: 21, baselineLoads: baseline } });
    const planned = weeklyExercise(PROGRAM, KG).per_day;
    const base = weeklyExercise(baseline, KG).per_day;
    expect(m.baseline_missing).toBe(false);
    expect(m.tdee).toBeCloseTo(2926 + planned - base, 9);
    expect(m.target_kcal).toBeCloseTo(m.tdee - 500, 9);
    expect(m.uncertainty_pct).toBe(0.12);
  });
  it("explicit empty baseline (no current exercise) is valid", () => {
    const m = buildEnergyModel({ mode: "measured", ...CLIENT, bmrMethod: "mifflin", neatFactor: 1.2, loads: PROGRAM, deficit: 500, measured: { tdee: 2926, days: 10, baselineLoads: [] } });
    expect(m.baseline_missing).toBe(false);
    expect(m.measured_window_short).toBe(true);
  });
});

describe("prediction band", () => {
  it("matches the spec example shape (−1.5 lb/week ± 0.6)", () => {
    // 750 kcal/day deficit on a 3,000 kcal TDEE at ±10%
    const b = predictionBand(-750, 3000, 0.1);
    expect(round1(b.central)).toBe(-1.5);
    expect(round1(b.low)).toBe(-2.1);
    expect(round1(b.high)).toBe(-0.9);
    expect(describePrediction({ predicted_lb_per_week: b.central, predicted_low: b.low, predicted_high: b.high })).toContain("likely between −0.9 and −2.1");
  });
});
