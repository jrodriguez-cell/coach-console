import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import type { LibExercise } from "./plan-types";
import {
  assembleTraining, buildSkeleton, cardioDays, cardioPrescription, chooseSplit, defaultPhaseSequence, defaultSelection,
  exerciseLoadsForWeek, isUsable, liftingDays, prescribe, sessionsForWeek,
} from "./training";
import { PHASES } from "@/config/training-variables";

export const LIB: LibExercise[] = EXERCISES.map((e) => ({
  id: e.slug, name: e.name, pattern: e.pattern, primary_muscles: e.primary_muscles, equipment: e.equipment,
  contraindications: e.contraindications, regression_id: e.regression, progression_id: e.progression, is_compound: e.is_compound,
}));

describe("seed library integrity", () => {
  it("has ~120+ exercises with valid regression/progression links", () => {
    expect(LIB.length).toBeGreaterThanOrEqual(120);
    const ids = new Set(LIB.map((e) => e.id));
    expect(ids.size).toBe(LIB.length);
    for (const e of LIB) {
      if (e.regression_id) expect(ids.has(e.regression_id), `${e.id} → ${e.regression_id}`).toBe(true);
      if (e.progression_id) expect(ids.has(e.progression_id), `${e.id} → ${e.progression_id}`).toBe(true);
    }
  });
  it("includes bodyweight and home-dumbbell options for every main pattern", () => {
    for (const pattern of ["squat", "hinge", "lunge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull"] as const) {
      expect(LIB.some((e) => e.pattern === pattern && isUsable(e, { equipment: "bodyweight", injuryAreas: [], dislikes: [] })), pattern).toBe(true);
      expect(LIB.some((e) => e.pattern === pattern && e.equipment.includes("dumbbell")), pattern).toBe(true);
    }
  });
});

describe("split and schedule", () => {
  it("chooses the split from days/week", () => {
    expect(chooseSplit(2)).toBe("full_body");
    expect(chooseSplit(3)).toBe("full_body");
    expect(chooseSplit(4)).toBe("upper_lower");
    expect(chooseSplit(5)).toBe("ppl");
    expect(chooseSplit(6)).toBe("ppl");
  });
  it("uses preferred days when enough are given", () => {
    expect(liftingDays(3, [2, 4, 6])).toEqual([2, 4, 6]);
    expect(liftingDays(3, [2])).toEqual([1, 3, 5]);
  });
  it("puts cardio on non-lifting days first", () => {
    expect(cardioDays(3, [1, 3, 5])).toEqual([2, 4, 6]);
    expect(cardioDays(5, [1, 3, 5])).toEqual([0, 1, 2, 4, 6]);
  });
});

describe("phases and prescriptions", () => {
  it("deconditioned clients start at endurance", () => {
    expect(defaultPhaseSequence("performance", "advanced", true, 12)[0]).toBe("endurance");
    expect(defaultPhaseSequence("performance", "advanced", false, 12)).toEqual(["hypertrophy", "strength", "power"]);
  });
  it("prescriptions stay within the phase variables", () => {
    for (const phase of ["endurance", "hypertrophy", "strength", "power"] as const) {
      const v = PHASES[phase];
      for (let w = 1; w <= 3; w++) {
        const p = prescribe(phase, "main", w);
        expect(p.sets).toBeGreaterThanOrEqual(v.setsMin);
        expect(p.sets).toBeLessThanOrEqual(v.setsMax);
        expect(p.reps_min).toBe(v.repsMin);
        expect(p.reps_max).toBe(v.repsMax);
        expect(p.rest_sec).toBeGreaterThanOrEqual(v.restSecMin);
        expect(p.rest_sec).toBeLessThanOrEqual(v.restSecMax);
      }
    }
  });
  it("deload every 4th week: ~40% fewer sets and RPE 5–6", () => {
    const build = prescribe("strength", "main", 3);
    const deload = prescribe("strength", "main", 4);
    expect(deload.sets).toBe(Math.round(build.sets * 0.6));
    expect([deload.rpe_min, deload.rpe_max]).toEqual([5, 6]);
  });
});

describe("cardio prescription", () => {
  it("weight loss: 3+ sessions × 30–90 min, deconditioned start at the low end", () => {
    const c = cardioPrescription({ goal: "weight_loss", weeks: 12, deconditioned: true, age: 40, liftingDays: [1, 3, 5] });
    expect(c.weeks[0]).toEqual({ week: 1, sessions: 3, minutes: 30 });
    for (const w of c.weeks) {
      expect(w.sessions).toBeGreaterThanOrEqual(3);
      expect(w.minutes).toBeGreaterThanOrEqual(30);
      expect(w.minutes).toBeLessThanOrEqual(90);
    }
    expect(c.hr_bpm).toEqual({ min: Math.round(180 * 0.7), max: Math.round(180 * 0.8) });
  });
  it("muscle gain never exceeds 30 minutes or 3 sessions", () => {
    const c = cardioPrescription({ goal: "muscle_gain", weeks: 12, deconditioned: false, age: 30, liftingDays: [1, 2, 4, 5] });
    for (const w of c.weeks) {
      expect(w.minutes).toBeLessThanOrEqual(30);
      expect(w.sessions).toBeLessThanOrEqual(3);
      expect(w.sessions).toBeGreaterThanOrEqual(2);
    }
  });
  it("general health builds toward 150 min/week", () => {
    const c = cardioPrescription({ goal: "general_health", weeks: 12, deconditioned: true, age: 50, liftingDays: [1, 4] });
    const last = c.weeks[11];
    expect(last.sessions * last.minutes).toBeGreaterThan(c.weeks[0].sessions * c.weeks[0].minutes);
  });
  it("performance: 3–5 × 15–30 min, zone 3", () => {
    const c = cardioPrescription({ goal: "performance", weeks: 12, deconditioned: false, age: 25, liftingDays: [1, 3, 5] });
    expect(c.zone).toBe("zone3");
    for (const w of c.weeks) {
      expect(w.minutes).toBeGreaterThanOrEqual(15);
      expect(w.minutes).toBeLessThanOrEqual(30);
    }
  });
  it("respects a clearance HR ceiling", () => {
    const c = cardioPrescription({ goal: "weight_loss", weeks: 4, deconditioned: false, age: 30, liftingDays: [1, 3, 5], hrCeiling: 130 });
    expect(c.hr_bpm!.max).toBeLessThanOrEqual(130);
  });
});

describe("skeleton → training plan", () => {
  const filter = { equipment: "home_basic" as const, injuryAreas: ["knee"], dislikes: ["burpee", "lunge"] };
  const sk = buildSkeleton({ goal: "weight_loss", daysPerWeek: 3, sessionLengthMin: 45, preferredDays: [], weeks: 12, phaseSequence: ["endurance", "hypertrophy", "strength"], level: "beginner", deconditioned: false, age: 40, filter }, LIB);

  it("filters candidates by equipment, contraindications and dislikes", () => {
    for (const s of sk.sessions) for (const slot of s.slots) for (const c of slot.candidates) {
      expect(c.equipment.every((e) => ["bodyweight", "box", "band", "dumbbell", "bench"].includes(e))).toBe(true);
      expect(c.contraindications).not.toContain("knee");
      expect(c.name.toLowerCase()).not.toContain("lunge");
    }
  });

  it("every main lift has a regression and progression when the library allows", () => {
    const t = assembleTraining(sk, Object.fromEntries(Object.entries(defaultSelection(sk)).map(([k, v]) => [k, { exercise_id: v }])), LIB, {
      weeks: 12, phaseSequence: ["endurance", "hypertrophy", "strength"], sessionLengthMin: 45, filter, shortRest: true, guidelines: [], clearanceNotes: null, coachingNotes: [], summary: "", source: "library_default",
    });
    const mains = t.sessions.flatMap((s) => s.slots.filter((x) => x.role === "main"));
    expect(mains.length).toBeGreaterThan(0);
    for (const m of mains) {
      expect(m.regression, m.exercise.name).not.toBeNull();
      expect(m.progression, m.exercise.name).not.toBeNull();
    }
    const libraryBoth = mains.filter((m) => m.regression?.id && m.progression?.id);
    expect(libraryBoth.length / mains.length).toBeGreaterThanOrEqual(0.6);
    // session length (plus warm-up) respected on every week
    for (const w of t.weeks) for (const m of Object.values(w.session_minutes)) expect(m + 8).toBeLessThanOrEqual(45);
    // early blocks keep more exercises than the heavy strength block
    const active = (wk: number) => Object.keys(t.weeks[wk - 1].prescriptions).length;
    expect(active(1)).toBeGreaterThanOrEqual(active(9));
    // energy loads include strength, cardio and mobility
    const loads = exerciseLoadsForWeek(t, 1);
    expect(loads.filter((l) => l.category === "strength").length).toBe(3);
    expect(loads.some((l) => l.category === "cardio")).toBe(true);
    expect(loads.some((l) => l.category === "mobility")).toBe(true);
    expect(sessionsForWeek(t, 1).map((s) => s.key)).toEqual(["A", "B", "C"]);
  });
});
