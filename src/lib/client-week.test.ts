import { describe, expect, it } from "vitest";
import { generatePlan, libraryDefaultSelector } from "./generator";
import { clientWeek, clientWeekText, currentPlanWeek } from "./client-week";
import { EX_LIB, FOOD_LIB, WL_INTAKE } from "@/test/fixtures";

async function plan() {
  return generatePlan({ goal: "weight_loss", intake: WL_INTAKE, referOut: null, referralsHandled: [], clearance: null, exercises: EX_LIB, foods: FOOD_LIB }, {}, "2026-10-05", libraryDefaultSelector);
}

describe("client week sheet", () => {
  it("lists every lifting day with prescribed exercises and no energy numbers", async () => {
    const p = await plan();
    const t = p.training!;
    const w = clientWeek({ clientName: "Sam", draft: false, parameters: p.parameters, training: t }, 2);
    expect(w.week).toBe(2);
    expect(w.days).toHaveLength(7);
    const liftDays = w.days.filter((d) => d.strength);
    expect(liftDays).toHaveLength(t.lifting_days.length);
    for (const d of liftDays) expect(d.strength!.exercises.length).toBeGreaterThan(0);
    const text = clientWeekText(w);
    expect(text).toContain("Week 2 of");
    expect(text).not.toMatch(/kcal|calorie|TDEE|checkpoint/i);
    expect(text).not.toContain("DRAFT");
    // one fill-in line per prescribed set
    const sets = liftDays.flatMap((d) => d.strength!.exercises).reduce((a, e) => a + e.sets, 0);
    expect(text.match(/Set \d+: ___ lb × ___/g)).toHaveLength(sets);
  });

  it("clamps the week and marks drafts", async () => {
    const p = await plan();
    const w = clientWeek({ clientName: "Sam", draft: true, parameters: p.parameters, training: p.training! }, 99);
    expect(w.week).toBe(p.training!.weeks.length);
    expect(clientWeekText(w)).toContain("DRAFT");
  });

  it("current plan week follows today's date", () => {
    expect(currentPlanWeek({ start_date: "2026-10-05", weeks: 12 }, "2026-10-01")).toBe(1);
    expect(currentPlanWeek({ start_date: "2026-10-05", weeks: 12 }, "2026-10-12")).toBe(2);
    expect(currentPlanWeek({ start_date: "2026-10-05", weeks: 12 }, "2027-06-01")).toBe(12);
  });
});
