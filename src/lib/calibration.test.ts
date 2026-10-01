import { describe, expect, it } from "vitest";
import { adherenceFromDaily, calibrate, slopeLbPerWeek } from "./calibration";
import { addDays } from "./dates";

const START = "2026-01-04";
// Weigh-ins from week 3 onward, losing `rate` lb/week.
function series(rate: number, weeks: number[], start = 270) {
  return weeks.map((w) => ({ date: addDays(START, (w - 1) * 7), weight: start - rate * (w - 1) }));
}

const base = {
  planStartDate: START,
  periodStart: START,
  periodEnd: addDays(START, 7 * 12),
  plannedLbPerWeek: -1.5,
  plannedBand: { low: -2.1, high: -0.9 },
  currentTargetKcal: 2400,
};

describe("calibration", () => {
  it("slope of a perfect line", () => {
    expect(slopeLbPerWeek(series(0.8, [3, 4, 5, 6]))).toBeCloseTo(-0.8, 9);
  });

  it("adherence 70% → fix_adherence (calories unchanged)", () => {
    const r = calibrate({ ...base, weighIns: series(0.8, [3, 4, 5, 6]), adherencePct: 70 });
    expect(r.decision).toBe("fix_adherence");
    expect(r.recommended_adjustment_kcal).toBe(0);
    expect(r.recommended_target_kcal).toBe(2400);
  });

  it("adherence 95%, observed −0.8 vs planned −1.5 → increase deficit, capped at 150", () => {
    const r = calibrate({ ...base, weighIns: series(0.8, [3, 4, 5, 6]), adherencePct: 95 });
    expect(r.decision).toBe("adjust");
    expect(r.observed_lb_per_week).toBeCloseTo(-0.8, 6);
    expect(r.recommended_adjustment_kcal).toBe(-150); // raw gap is 350 kcal/day
    expect(r.recommended_target_kcal).toBe(2250);
    expect(r.implied_daily_balance).toBeCloseTo(-400, 6);
    expect(r.new_uncertainty_pct).toBe(0.05);
  });

  it("fewer than 3 weigh-ins → insufficient_data", () => {
    const r = calibrate({ ...base, weighIns: series(0.8, [3, 6]), adherencePct: 95 });
    expect(r.decision).toBe("insufficient_data");
  });

  it("weeks 1–2 are excluded", () => {
    const r = calibrate({ ...base, weighIns: series(0.8, [1, 2, 3]), adherencePct: 95 });
    expect(r.decision).toBe("insufficient_data");
    expect(r.weigh_in_points).toBe(1);
  });

  it("3 points spanning fewer than 14 days → insufficient_data", () => {
    const pts = [
      { date: addDays(START, 14), weight: 268 },
      { date: addDays(START, 18), weight: 267.5 },
      { date: addDays(START, 21), weight: 267 },
    ];
    expect(calibrate({ ...base, weighIns: pts, adherencePct: 95 }).decision).toBe("insufficient_data");
  });

  it("inside the band → keep", () => {
    const r = calibrate({ ...base, weighIns: series(1.4, [3, 4, 5, 6]), adherencePct: 90 });
    expect(r.decision).toBe("keep");
  });

  it("losing too fast → raise calories (capped)", () => {
    const r = calibrate({ ...base, weighIns: series(2.6, [3, 4, 5, 6]), adherencePct: 90 });
    expect(r.decision).toBe("adjust");
    expect(r.recommended_adjustment_kcal).toBe(150);
  });

  it("never recommends a target below the calorie floor", () => {
    const r = calibrate({ ...base, currentTargetKcal: 1250, weighIns: series(0.2, [3, 4, 5, 6]), adherencePct: 95 });
    expect(r.recommended_target_kcal).toBeGreaterThanOrEqual(1200);
  });
});

describe("adherence from daily entries", () => {
  it("counts days within calorie tolerance and protein ≥ minimum", () => {
    const days = [
      { date: "a", calories: 2000, protein_g: 150 },
      { date: "b", calories: 2150, protein_g: 150 }, // outside ±100
      { date: "c", calories: 1950, protein_g: 120 }, // protein low
      { date: "d", calories: 2050, protein_g: 145 },
      { date: "e", calories: null, protein_g: null }, // not logged
    ];
    expect(adherenceFromDaily(days, { calories: 2000, calorieTol: 100, proteinMin: 140 })).toBe(50);
    expect(adherenceFromDaily([], { calories: 2000, calorieTol: 100, proteinMin: 140 })).toBeNull();
  });
});
