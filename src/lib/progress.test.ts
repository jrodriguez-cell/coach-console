import { describe, expect, it } from "vitest";
import {
  adherenceWindow, benchmarkProgress, consecutiveOffTrajectory, e1rm, fiveRm, liftSummary, personalRecords, plannedTrajectory,
  progressionReadiness, sessionCompletion, trend7, twoInARowBelow, weeklyVolume, weightStatus, type SetLog,
} from "./progress";
import { addDays } from "./dates";

const S = "2026-01-04";
const wk = (n: number, v: number) => ({ date: addDays(S, n * 7), value: v });

describe("weight", () => {
  it("7-day trend averages the trailing week", () => {
    const t = trend7([{ date: "2026-01-01", value: 200 }, { date: "2026-01-04", value: 198 }, { date: "2026-01-09", value: 196 }]);
    expect(t.map((x) => x.value)).toEqual([200, 199, 197]);
  });
  it("planned trajectory and band", () => {
    const t = plannedTrajectory({ startDate: S, startWeight: 270, plannedLbPerWeek: -1.5, bandHalfWidthLbPerWeek: 0.6, weeks: 12 });
    expect(t[12].planned).toBe(252);
    expect(t[12].low).toBeCloseTo(244.8, 6);
    expect(t[12].high).toBeCloseTo(259.2, 6);
  });
  const plan = { startDate: S, startWeight: 270, plannedLbPerWeek: -1.5, bandHalfWidthLbPerWeek: 0.25, goalWeight: 240 };
  it("on track", () => {
    const r = weightStatus({ ...plan, weighIns: [wk(0, 270), wk(1, 268.5), wk(2, 267), wk(3, 265.5), wk(4, 264)] });
    expect(r.status).toBe("on_track");
    expect(r.cumulativeChange).toBe(-6);
    expect(r.lbsToGoal).toBe(24);
    expect(r.observedLbPerWeek).toBeCloseTo(-1.5, 6);
  });
  it("behind / slightly behind / ahead for a loss plan", () => {
    expect(weightStatus({ ...plan, weighIns: [wk(0, 270), wk(8, 268)] }).status).toBe("behind");
    expect(weightStatus({ ...plan, weighIns: [wk(0, 270), wk(8, 260.5)] }).status).toBe("slightly_behind");
    expect(weightStatus({ ...plan, weighIns: [wk(0, 270), wk(8, 252)] }).status).toBe("ahead");
    expect(weightStatus({ ...plan, weighIns: [] }).status).toBe("no_data");
  });
  it("gain plans invert the direction", () => {
    const g = { startDate: S, startWeight: 160, plannedLbPerWeek: 0.4, bandHalfWidthLbPerWeek: 0.1 };
    expect(weightStatus({ ...g, weighIns: [wk(0, 160), wk(10, 160)] }).status).toBe("behind");
    expect(weightStatus({ ...g, weighIns: [wk(0, 160), wk(10, 168)] }).status).toBe("ahead");
  });
  it("counts consecutive off-trajectory weigh-ins", () => {
    const r = consecutiveOffTrajectory({ ...plan, weighIns: [wk(0, 270), wk(4, 264), wk(6, 268), wk(7, 268)] });
    expect(r.count).toBe(2);
  });
});

describe("strength", () => {
  it("Epley e1RM and 5RM", () => {
    expect(e1rm(200, 5)).toBeCloseTo(233.333, 3);
    expect(fiveRm(e1rm(200, 5))).toBeCloseTo(200, 9);
    // RPE 8 → 2 reps in reserve
    expect(e1rm(200, 5, 8)).toBeCloseTo(200 * (1 + 7 / 30), 9);
  });
  const sets = (date: string, w: number, reps: number, test = false, rpe: number | null = null): SetLog => ({ date, exercise_id: "squat", exercise_name: "Squat", set_number: 1, weight_lb: w, reps, rpe, is_test: test });
  it("baseline vs latest test, retention flag below 95% for weight loss", () => {
    const [s] = liftSummary([sets("2026-01-05", 200, 5, true), sets("2026-01-20", 210, 5), sets("2026-02-01", 185, 5, true)], { flagBelowPct: 95 });
    expect(s.baseline5rm).toBeCloseTo(200, 6);
    expect(s.latest5rm).toBeCloseTo(185, 6);
    expect(s.pctOfBaseline).toBeCloseTo(92.5, 6);
    expect(s.flagLow).toBe(true);
  });
  it("personal records", () => {
    const prs = personalRecords([{ date: "a", value: 100 }, { date: "b", value: 105 }, { date: "c", value: 103 }, { date: "d", value: 110 }]);
    expect(prs.map((p) => p.date)).toEqual(["b", "d"]);
  });
  it("double-progression readiness", () => {
    expect(progressionReadiness([sets("d", 100, 12, false, 8), sets("d", 100, 12, false, 7.5)], 12)).toBe("add_weight");
    expect(progressionReadiness([sets("d", 100, 12, false, 9), sets("d", 100, 12, false, 8)], 12)).toBe("not_yet");
    expect(progressionReadiness([sets("d", 100, 11, false, 7)], 12)).toBe("not_yet");
    expect(progressionReadiness([sets("d", 100, 12)], 12)).toBe("rpe_not_logged");
    expect(progressionReadiness([], 12)).toBe("no_data");
  });
  it("weekly volume by Monday", () => {
    const v = weeklyVolume([sets("2026-01-05", 100, 10), sets("2026-01-07", 100, 10), sets("2026-01-12", 50, 10)]);
    expect(v).toEqual([{ date: "2026-01-05", value: 2000 }, { date: "2026-01-12", value: 500 }]);
  });
});

describe("benchmarks", () => {
  const b = { direction: "lower_better" as const, baseline: 30, target: 25, target_date: "2026-04-01", created_at: "2026-01-01" };
  it("% of the way and on-track vs target date", () => {
    const r = benchmarkProgress(b, 27.5, "2026-02-15");
    expect(r.pct).toBeCloseTo(50, 6);
    expect(r.status).toBe("on_track");
    expect(benchmarkProgress(b, 29.5, "2026-03-15").status).toBe("behind");
    expect(benchmarkProgress(b, 24.8, "2026-02-01").status).toBe("achieved");
    expect(benchmarkProgress(b, null, "2026-02-01").status).toBe("no_data");
  });
});

describe("adherence", () => {
  it("sessions completed vs scheduled (partial counts half)", () => {
    expect(sessionCompletion([{ date: "a", status: "completed" }, { date: "b", status: "partial" }, { date: "c", status: "missed" }], 4).pct).toBeCloseTo(37.5, 6);
  });
  it("combines workouts and food logs; weekly entries only as a fallback", () => {
    const target = { calories: 2000, calorieTol: 100, proteinMin: 140 };
    const daily = [{ date: "a", calories: 2000, protein_g: 150 }, { date: "b", calories: 2600, protein_g: 150 }];
    const both = adherenceWindow({ daily, weeklyAdherence: [{ date: "a", value: 10 }], workouts: { pct: 80 }, target });
    expect(both).toMatchObject({ source: "workouts_nutrition", pct: 65, workoutsPct: 80, nutritionPct: 50 });
    expect(adherenceWindow({ daily: [], weeklyAdherence: [{ date: "a", value: 10 }], workouts: { pct: 75 }, target })).toMatchObject({ source: "workouts", pct: 75 });
    expect(adherenceWindow({ daily, weeklyAdherence: [], workouts: { pct: null }, target }).source).toBe("nutrition_daily");
    expect(adherenceWindow({ daily: [], weeklyAdherence: [{ date: "a", value: 60 }, { date: "b", value: 80 }], workouts: { pct: null }, target }).pct).toBe(70);
    expect(adherenceWindow({ daily: [], weeklyAdherence: [], workouts: { pct: null }, target }).source).toBe("none");
  });
  it("two low energy entries in a row", () => {
    expect(twoInARowBelow([{ date: "2026-01-01", value: 4 }, { date: "2026-01-08", value: 3 }], 5)).toBe("2026-01-08");
    expect(twoInARowBelow([{ date: "2026-01-01", value: 4 }, { date: "2026-01-08", value: 6 }], 5)).toBeNull();
  });
});
