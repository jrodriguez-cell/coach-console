import { describe, expect, it } from "vitest";
import { applyRpeCeiling, deriveNutrition, diffDerived, generatePlan, libraryDefaultSelector, type GeneratorContext } from "./generator";
import { kcalFromMacros } from "./nutrition";
import { EX_LIB, FOOD_LIB, PERF_INTAKE, WL_INTAKE } from "@/test/fixtures";
import { GOAL_CATEGORIES } from "@/config/goal-templates";

const base = (over: Partial<GeneratorContext> = {}): GeneratorContext => ({
  goal: "weight_loss", intake: WL_INTAKE, referOut: null, referralsHandled: [], clearance: null, exercises: EX_LIB, foods: FOOD_LIB, ...over,
});

describe("generator", () => {
  it("weight-loss sample: full pipeline with reconciled macros and example days", async () => {
    const p = await generatePlan(base(), {}, "2026-10-05", libraryDefaultSelector);
    expect(p.training?.split).toBe("upper_lower");
    expect(p.energy?.planned_exercise_kcal_per_day).toBeGreaterThan(0);
    const t = p.nutrition.targets!;
    expect(Math.abs(kcalFromMacros(t.protein_g, t.carbs_g, t.fat_g) - t.calories)).toBeLessThanOrEqual(2);
    expect(t.calories).toBe(Math.round(p.energy!.target_kcal));
    expect(p.energy!.tdee - p.energy!.target_kcal).toBeCloseTo(400, 6);
    expect(p.nutrition.example_days.length).toBeGreaterThanOrEqual(3);
    expect(p.nutrition.example_days.flatMap((d) => d.meals.flatMap((m) => m.items)).some((i) => i.name.toLowerCase().includes("tuna"))).toBe(false);
    expect(p.guardrail_flags.find((g) => g.rule_key === "calories_min")?.status).toBe("ok");
    expect(p.parameters.checkpoint_weeks).toEqual([3, 8, 11]);
    expect(p.nutrition.prediction_text).toMatch(/likely between/);
  });

  it("performance sample: full body, power slots, vegetarian peanut-free foods, ankle contraindications", async () => {
    const p = await generatePlan(base({ goal: "performance", intake: PERF_INTAKE }), {}, "2026-10-05", libraryDefaultSelector);
    expect(p.training?.split).toBe("full_body");
    expect(p.training?.sessions.some((s) => s.slots.some((x) => x.role === "power"))).toBe(true);
    for (const s of p.training!.sessions) for (const x of s.slots) {
      const ex = EX_LIB.find((e) => e.id === x.exercise.id)!;
      expect(ex.contraindications).not.toContain("ankle");
    }
    for (const d of p.nutrition.example_days) for (const m of d.meals) for (const i of m.items) {
      const f = FOOD_LIB.find((x) => x.id === i.food_id)!;
      expect(f.allergens).not.toContain("peanut");
      expect(f.dietary_tags).toContain("vegetarian");
    }
    expect(p.training?.cardio.zone).toBe("zone3");
  });

  it("every goal category generates", async () => {
    for (const goal of GOAL_CATEGORIES) {
      const p = await generatePlan(base({ goal }), {}, "2026-10-05", libraryDefaultSelector);
      expect(p.nutrition.targets, goal).not.toBeNull();
      expect(p.training, goal).not.toBeNull();
    }
  });

  it("eating-disorder flag blocks nutrition until handled", async () => {
    const blocked = await generatePlan(base({ referOut: { eating_disorder: true } }), {}, "2026-10-05", libraryDefaultSelector);
    expect(blocked.nutrition.blocked).toBe(true);
    expect(blocked.nutrition.targets).toBeNull();
    expect(blocked.energy).toBeNull();
    expect(blocked.training).not.toBeNull();
    const handled = await generatePlan(base({ referOut: { eating_disorder: true }, referralsHandled: [{ flag: "eating_disorder", handled_note: "Referred to RD; RD provided targets" }] }), {}, "2026-10-05", libraryDefaultSelector);
    expect(handled.nutrition.blocked).toBe(false);
  });

  it("acute injury blocks training (energy falls back to current exercise)", async () => {
    const p = await generatePlan(base({ referOut: { acute_injury: true } }), {}, "2026-10-05", libraryDefaultSelector);
    expect(p.training).toBeNull();
    expect(p.training_blocked_reason).toMatch(/refer out/);
    expect(p.nutrition.targets).not.toBeNull();
  });

  it("measured TDEE without baseline exercise is BLOCKED by guardrails", async () => {
    const intake = { ...WL_INTAKE, measured_tdee: 2926, measured_tdee_days: 21, current_exercise: [], current_exercise_confirmed: false };
    const p = await generatePlan(base({ intake }), {}, "2026-10-05", libraryDefaultSelector);
    expect(p.energy?.mode).toBe("measured");
    expect(p.guardrail_flags.find((g) => g.rule_key === "measured_baseline")?.status).toBe("blocked");
  });

  it("clearance RPE ceiling caps every prescription; HR ceiling caps cardio", async () => {
    const p = await generatePlan(base({ clearance: { status: "received", notes: "OK to train", exercise_limits: "No overhead pressing", hr_ceiling: 140, rpe_ceiling: 7, activities_to_avoid: "Running" } }), {}, "2026-10-05", libraryDefaultSelector);
    for (const w of p.training!.weeks) for (const rx of Object.values(w.prescriptions)) expect(rx.rpe_max).toBeLessThanOrEqual(7);
    expect(p.training!.cardio.hr_bpm?.max ?? 0).toBeLessThanOrEqual(140);
    expect(p.training!.clearance_notes).toContain("Heart-rate ceiling: 140 bpm");
    expect(applyRpeCeiling(p.training!, null)).toBe(p.training);
  });

  it("editing cardio recomputes the energy model and shows what changed", async () => {
    const ctx = base();
    const p = await generatePlan(ctx, {}, "2026-10-05", libraryDefaultSelector);
    const t2 = { ...p.training!, cardio: { ...p.training!.cardio, weeks: p.training!.cardio.weeks.map((w) => ({ ...w, minutes: w.minutes + 20 })) } };
    const after = deriveNutrition(ctx, p.parameters, t2);
    const rows = diffDerived({ energy: p.energy, nutrition: p.nutrition }, after);
    expect(rows.map((r) => r.label)).toContain("Planned exercise (kcal/day)");
    expect(rows.map((r) => r.label)).toContain("Calorie target");
    expect(after.nutrition.targets!.calories).toBeGreaterThan(p.nutrition.targets!.calories);
  });

  it("removing cardio requires an override (warn)", async () => {
    const ctx = base();
    const p = await generatePlan(ctx, {}, "2026-10-05", libraryDefaultSelector);
    const t2 = { ...p.training!, cardio: { ...p.training!.cardio, removed: true, weeks: p.training!.cardio.weeks.map((w) => ({ ...w, sessions: 0, minutes: 0 })) } };
    const after = deriveNutrition(ctx, p.parameters, t2);
    expect(after.guardrail_flags.find((g) => g.rule_key === "cardio_removed")?.status).toBe("warn");
  });
});
