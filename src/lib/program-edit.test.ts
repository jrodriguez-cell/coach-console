import { describe, expect, it } from "vitest";
import { generatePlan, libraryDefaultSelector } from "./generator";
import { EX_LIB, FOOD_LIB, WL_INTAKE } from "@/test/fixtures";
import { addExercise, applyCoachNotes, applySkill, canSwap, refitProgram, regressMovement, removeExercise, swapExercise, type EditContext } from "./program-edit";
import { MOBILITY, WEAKNESSES } from "@/config/coach-notes";
import { EXERCISES } from "@/data/exercises";
import type { CoachNote } from "./intake";
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

describe("coach notes", () => {
  const note = (over: Partial<CoachNote>): CoachNote => ({ id: over.id ?? "n1", date: "2026-10-16", kind: "other", text: "", active: true, ...over });

  it("every exercise named in the note rules exists in the library", () => {
    const slugs = new Set(EXERCISES.map((e) => e.slug));
    for (const [k, v] of Object.entries(WEAKNESSES)) for (const s of v.work) expect(slugs.has(s), `${k}: ${s}`).toBe(true);
    for (const [k, v] of Object.entries(MOBILITY)) for (const s of v.drills) expect(slugs.has(s), `${k}: ${s}`).toBe(true);
  });

  it("adds corrective work and mobility drills to the sessions that need them, and removes them when resolved", async () => {
    const t = await plan();
    const notes = [note({ id: "w", kind: "weakness", movement: "hinge", text: "rounds back" }), note({ id: "m", kind: "mobility", mobility: "ankle" })];
    const { training, changes } = applyCoachNotes(t, ctx, notes);
    expect(changes.length).toBeGreaterThan(0);
    for (const s of training.sessions) {
      const hinge = s.slots.some((x) => x.pattern === "hinge" && (x.role === "main" || x.role === "secondary") && !x.from_note);
      const squat = s.slots.some((x) => (x.pattern === "squat" || x.pattern === "lunge") && (x.role === "main" || x.role === "secondary") && !x.from_note);
      expect(s.slots.some((x) => x.from_note === "w"), `${s.name} hinge work`).toBe(hinge);
      if (squat) {
        const i = s.slots.findIndex((x) => x.from_note === "m");
        expect(i, `${s.name} ankle drill`).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThanOrEqual(1); // at the start of the session
      }
      for (const x of s.slots.filter((x) => x.from_note)) for (const w of training.weeks) if (s.block == null || Math.floor((w.week - 1) / 4) === s.block - 1) expect(w.prescriptions[x.id]).toBeDefined();
    }
    // applying again doesn't duplicate; resolving removes
    const again = applyCoachNotes(training, ctx, notes);
    expect(again.changes).toEqual([]);
    expect(again.training.sessions.flatMap((s) => s.slots).filter((x) => x.from_note).length).toBe(training.sessions.flatMap((s) => s.slots).filter((x) => x.from_note).length);
    const gone = applyCoachNotes(training, ctx, notes.map((n) => ({ ...n, active: false })));
    expect(gone.training.sessions.flatMap((s) => s.slots).some((x) => x.from_note)).toBe(false);
    expect(gone.changes.some((c) => /note resolved/.test(c))).toBe(true);
  });

  it("can make the main lift for a weak movement one step easier", async () => {
    const t = await plan();
    const { training, changes } = regressMovement(t, ctx, "squat");
    const mains = (tt: typeof t) => tt.sessions.flatMap((s) => s.slots).filter((x) => x.role === "main" && x.pattern === "squat");
    if (mains(t).some((m) => m.regression?.id)) {
      expect(changes.length).toBeGreaterThan(0);
      expect(mains(training).map((m) => m.exercise.id)).not.toEqual(mains(t).map((m) => m.exercise.id));
    }
  });
});
