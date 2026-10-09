import { describe, expect, it } from "vitest";
import { generatePlan, libraryDefaultSelector } from "./generator";
import { EX_LIB, FOOD_LIB, WL_INTAKE } from "@/test/fixtures";
import { addExercise, applySkill, canSwap, refitProgram, removeExercise, swapExercise, type EditContext } from "./program-edit";
import { sessionsForWeek } from "./training";

const intake = { ...WL_INTAKE, primary_goal: "Feel better", training_days_per_week: 3, training_history: "beginner" as const, activity_level: "on_feet_part" as const, equipment: "home_basic" as const };
const ctx: EditContext = { lib: EX_LIB, filter: { equipment: "home_basic", injuryAreas: [], dislikes: [] }, level: "beginner" };
const plan = async () => (await generatePlan({ goal: "general_health", intake, referOut: null, referralsHandled: [], exercises: EX_LIB, foods: FOOD_LIB, clearance: null }, { start_date: "2026-10-05", weeks: 12, skill: "none" }, "2026-10-05", libraryDefaultSelector)).training!;
const week = (t: Awaited<ReturnType<typeof plan>>, w: number) => sessionsForWeek(t, w).map(({ key }) => t.sessions.find((s) => s.key === key)!);

describe("program edits", () => {
  it("adds L-sit work to an existing plan: step first every session, climbing each block, with prescriptions", async () => {
    const t0 = await plan();
    expect(t0.skill).toBeNull();
    const t = applySkill(t0, "l_sit", ctx);
    expect(t.skill).toBe("l_sit");
    expect(t.split_reasons![0]).toMatch(/Skill goal: L-sit/);
    for (const [w, step] of [[1, /Support Hold/], [5, /Tuck L-Sit/], [9, /Single-Leg L-Sit/]] as const) {
      for (const s of week(t, w)) {
        expect(s.slots[0].role).toBe("skill");
        expect(s.slots[0].exercise.name).toMatch(step);
        expect(t.weeks[w - 1].prescriptions[s.slots[0].id]).toBeDefined();
        expect(s.slots.filter((x) => x.skill && x.role !== "skill").length).toBeGreaterThan(0);
      }
    }
    // switching skill replaces it; "none" removes it all
    const ps = applySkill(t, "push_up", ctx);
    expect(ps.sessions.flatMap((s) => s.slots).some((x) => x.skill === "l_sit")).toBe(false);
    const none = applySkill(ps, null, ctx);
    expect(none.sessions.flatMap((s) => s.slots).some((x) => x.skill)).toBe(false);
    expect(Object.keys(none.weeks[0].prescriptions).length).toBe(Object.keys(t0.weeks[0].prescriptions).length);
  });

  it("swaps for one block or the whole plan", async () => {
    const t = await plan();
    const s1 = week(t, 1)[0];
    const slot = s1.slots.find((x) => x.role === "main")!;
    const alt = EX_LIB.find((e) => e.pattern === slot.pattern && e.id !== slot.exercise.id && !canSwap(slot, e, ctx))!;
    const blockOnly = swapExercise(t, slot.id, alt, "block", ctx);
    expect(week(blockOnly, 1)[0].slots.find((x) => x.id === slot.id)!.exercise.id).toBe(alt.id);
    expect(week(blockOnly, 5)[0].slots.find((x) => x.pattern === slot.pattern && x.role === "main")!.exercise.id).toBe(slot.exercise.id);
    const whole = swapExercise(t, slot.id, alt, "plan", ctx);
    for (const w of [1, 5, 9]) expect(week(whole, w)[0].slots.find((x) => x.role === "main" && x.pattern === slot.pattern)!.exercise.id).toBe(alt.id);
    expect(canSwap(slot, EX_LIB.find((e) => e.pattern !== slot.pattern)!, ctx)).toMatch(/same movement/);
  });

  it("adds and removes exercises with prescriptions", async () => {
    const t = await plan();
    const s = week(t, 1)[0];
    const ex = EX_LIB.find((e) => e.slug === "seated_pike_stretch")!;
    const added = addExercise(t, s.key, ex, "plan", ctx);
    for (const w of [1, 5, 9]) {
      const sl = week(added, w)[0].slots.find((x) => x.exercise.id === ex.id)!;
      expect(sl).toBeDefined();
      expect(added.weeks[w - 1].prescriptions[sl.id]).toBeDefined();
    }
    const id = week(added, 1)[0].slots.find((x) => x.exercise.id === ex.id)!.id;
    const removed = removeExercise(added, id, "plan");
    for (const w of [1, 5, 9]) expect(week(removed, w)[0].slots.some((x) => x.exercise.id === ex.id)).toBe(false);
  });
});

describe("refit to new client details", () => {
  it("swaps out exercises the client can no longer do and adds a skill named in their goals", async () => {
    const t = await plan();
    const bw: EditContext = { lib: EX_LIB, filter: { equipment: "bodyweight", injuryAreas: ["knee"], dislikes: [] }, level: "beginner" };
    const { training, changes } = refitProgram(t, bw, "l_sit");
    expect(changes.length).toBeGreaterThan(1);
    expect(changes.some((c) => /L-sit/.test(c))).toBe(true);
    const byId = new Map(EX_LIB.map((e) => [e.id, e]));
    for (const s of training.sessions) for (const sl of s.slots) {
      const ex = byId.get(sl.exercise.id)!;
      const ok = ex.equipment.every((q) => ["bodyweight", "box"].includes(q)) && !ex.contraindications.includes("knee");
      if (!ok) expect(sl.exercise.name, `${s.name}: still needs equipment`).toBe("(no usable alternative)");
    }
    // nothing to change → no changes
    expect(refitProgram(training, bw, "l_sit").changes).toEqual([]);
  });
});
