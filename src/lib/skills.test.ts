import { describe, expect, it } from "vitest";
import { generatePlan, libraryDefaultSelector, type GeneratorContext } from "./generator";
import { EX_LIB, FOOD_LIB, WL_INTAKE } from "@/test/fixtures";
import { detectSkill, SKILLS, SKILL_KEYS } from "@/config/skills";
import { EXERCISES } from "@/data/exercises";
import { sessionsForWeek } from "./training";

// GES: general health, goal is an L-sit, PAR-Q flagged with clearance pending.
const GES = { ...WL_INTAKE, primary_goal: "Be able to do an L-sit", success_90_days: "Hold an L-sit for 10 seconds", training_days_per_week: 3, training_history: "beginner" as const, activity_level: "on_feet_part" as const, equipment: "home_basic" as const };
const ctx = (over: Partial<GeneratorContext> = {}): GeneratorContext => ({
  goal: "general_health", intake: GES, referOut: null, referralsHandled: [], parqFlagged: true,
  clearance: { status: "pending", notes: null, exercise_limits: null, hr_ceiling: null, rpe_ceiling: null, activities_to_avoid: null },
  exercises: EX_LIB, foods: FOOD_LIB, ...over,
});

describe("skill goals", () => {
  it("every skill ladder and support exercise exists in the library", () => {
    const slugs = new Set(EXERCISES.map((e) => e.slug));
    for (const k of SKILL_KEYS) {
      for (const s of SKILLS[k].ladder) expect(slugs.has(s), `${k}: ${s}`).toBe(true);
      for (const s of SKILLS[k].support) if (s.slug) expect(slugs.has(s.slug), `${k}: ${s.slug}`).toBe(true);
    }
  });

  it("detects the skill in the client's goal words", () => {
    expect(detectSkill("Be able to do an L-sit")).toBe("l_sit");
    expect(detectSkill("first pull up by summer")).toBe("pull_up");
    expect(detectSkill("hold a handstand")).toBe("handstand");
    expect(detectSkill("touch my toes")).toBe("toe_touch");
    expect(detectSkill("lose 10 lb")).toBeNull();
  });

  it("GES: builds an L-sit progression into every session and holds cardio until clearance", async () => {
    const p = await generatePlan(ctx(), { start_date: "2026-10-05", weeks: 12 }, "2026-10-05", libraryDefaultSelector);
    const t = p.training!;
    expect(t.skill).toBe("l_sit");
    expect(t.split_reasons![0]).toMatch(/Skill goal: L-sit/);
    expect(t.split_reasons!.some((r) => /clearance/i.test(r))).toBe(true);
    // Every session of every week starts with the skill step, and the step climbs each block.
    const stepIn = (week: number) => sessionsForWeek(t, week).map(({ key }) => t.sessions.find((s) => s.key === key)!.slots[0]);
    for (const w of [1, 5, 9]) for (const sl of stepIn(w)) expect(sl.role).toBe("skill");
    expect(stepIn(1)[0].exercise.name).toMatch(/Support Hold/);
    expect(stepIn(5)[0].exercise.name).toMatch(/Tuck L-Sit/);
    expect(stepIn(9)[0].exercise.name).toMatch(/Single-Leg L-Sit/);
    expect(stepIn(1)[0].unit).toBe("seconds");
    // Supporting work (compression, scapular, pike flexibility…) appears across the week.
    const support = t.sessions.filter((s) => (s.block ?? 1) === 1).flatMap((s) => s.slots.filter((x) => x.skill && x.role !== "skill").map((x) => x.exercise.name));
    expect(support.join(" ")).toMatch(/Scapular Depressions/);
    expect(support.join(" ")).toMatch(/Pike/);
    // The skill is never trimmed for time.
    for (const w of t.weeks) for (const { key } of sessionsForWeek(t, w.week)) expect(w.prescriptions[`${key}-1`], `week ${w.week} ${key}`).toBeDefined();
    // Clearance pending: no cardio, every prescription at RPE 6 or less.
    expect(t.cardio.removed).toBe(true);
    expect(t.cardio.weeks.every((w) => w.sessions === 0)).toBe(true);
    for (const w of t.weeks) for (const rx of Object.values(w.prescriptions)) expect(rx.rpe_max).toBeLessThanOrEqual(6);
  });

  it("clearance received: cardio comes back; trainer can switch the skill off", async () => {
    const cleared = await generatePlan(ctx({ clearance: { status: "received", notes: "ok", exercise_limits: null, hr_ceiling: null, rpe_ceiling: null, activities_to_avoid: null } }), {}, "2026-10-05", libraryDefaultSelector);
    expect(cleared.training!.cardio.removed).toBe(false);
    const none = await generatePlan(ctx({ parqFlagged: false }), { skill: "none" }, "2026-10-05", libraryDefaultSelector);
    expect(none.training!.skill).toBeNull();
    expect(none.training!.sessions.some((s) => s.slots.some((x) => x.role === "skill"))).toBe(false);
  });

  it("every skill builds on every equipment level without errors", async () => {
    for (const k of SKILL_KEYS) for (const equipment of ["bodyweight", "home_basic", "commercial_gym"] as const) {
      const p = await generatePlan(ctx({ parqFlagged: false, intake: { ...GES, equipment } }), { skill: k }, "2026-10-05", libraryDefaultSelector);
      expect(p.training, `${k}/${equipment}`).toBeTruthy();
    }
  });
});
