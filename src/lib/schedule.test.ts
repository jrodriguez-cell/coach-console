import { describe, expect, it } from "vitest";
import { generatePlan, libraryDefaultSelector } from "./generator";
import { EX_LIB, FOOD_LIB, WL_INTAKE } from "@/test/fixtures";
import { CARDIO_KEY, plannedItems, plannedItemsForWeek, sessionLabel, weekChecklist, workoutAdherence, type SessionRecord } from "./schedule";
import { planCalendar } from "./calendar";

const START = "2026-09-07"; // a Monday
async function plan() {
  const p = await generatePlan({ goal: "weight_loss", intake: { ...WL_INTAKE, training_days_per_week: 3, preferred_days: [1, 3, 5] }, referOut: null, referralsHandled: [], clearance: null, exercises: EX_LIB, foods: FOOD_LIB }, { start_date: START, weeks: 8 }, START, libraryDefaultSelector);
  return { params: p.parameters, t: p.training! };
}

describe("schedule", () => {
  it("lists each week's strength, cardio and mobility, matching the calendar", async () => {
    const { params, t } = await plan();
    const items = plannedItemsForWeek(params, t, 1);
    const strength = items.filter((i) => i.kind === "strength");
    expect(strength.map((i) => i.date)).toEqual(["2026-09-07", "2026-09-09", "2026-09-11"]);
    expect(items.filter((i) => i.kind === "cardio").length).toBe(t.cardio.weeks[0].sessions);
    // Same workouts the calendar shows.
    const cal = planCalendar(params, t)[0];
    for (const d of cal.days) {
      expect(d.items.filter((x) => x.startsWith("Strength:")).length).toBe(items.filter((i) => i.date === d.date && i.kind === "strength").length);
      expect(d.items.filter((x) => x.startsWith("Cardio:")).length).toBe(items.filter((i) => i.date === d.date && i.kind === "cardio").length);
    }
    expect(plannedItems(params, t, "2026-09-07", "2026-09-20").filter((i) => i.kind === "strength").length).toBe(6);
  });

  it("adherence: done ÷ due, today counts only once done, moved days still count", async () => {
    const { params, t } = await plan();
    const today = "2026-09-11"; // Friday of week 1
    const items = plannedItems(params, t, START, today);
    const strength = items.filter((i) => i.kind === "strength");
    const cardio = items.filter((i) => i.kind === "cardio");
    const pastCardio = cardio.filter((i) => i.date < today);
    // Monday done on Tuesday (moved), Wednesday missed, Friday not done yet.
    const recs: SessionRecord[] = [{ date: "2026-09-08", planned_session_key: strength[0].key, status: "completed", source: "checkoff" }];
    const a = workoutAdherence(items, recs, START, today);
    expect(a.strength).toEqual({ due: 2, done: 1 });
    expect(a.cardio.due).toBe(pastCardio.length);
    // Friday checked off: it becomes due and done.
    const b = workoutAdherence(items, [...recs, { date: today, planned_session_key: strength[2].key, status: "completed", source: "checkoff" }], START, today);
    expect(b.strength).toEqual({ due: 3, done: 2 });
    // Partial counts half; extra workouts never exceed what was due.
    const c = workoutAdherence(items, [{ date: "2026-09-07", planned_session_key: strength[0].key, status: "partial" }, ...Array.from({ length: 5 }, () => ({ date: "2026-09-09", planned_session_key: strength[1].key, status: "completed" as const }))], START, today);
    expect(c.strength.done).toBe(2);
    // Cardio check-offs count as cardio, not strength.
    const d = workoutAdherence(items, pastCardio.map((i) => ({ date: i.date, planned_session_key: CARDIO_KEY, status: "completed" as const })), START, today);
    expect(d.cardio.done).toBe(pastCardio.length);
    expect(d.strength.done).toBe(0);
    expect(d.pct).toBeCloseTo((pastCardio.length / (2 + pastCardio.length)) * 100, 6);
    // Cardio logged as minutes counts as sessions' worth of cardio.
    const perSession = pastCardio[0].minutes!;
    expect(workoutAdherence(items, [], START, today, { cardioMinutesLogged: perSession * 1.5 }).cardio.done).toBe(Math.min(1.5, pastCardio.length));
    // Nothing due before the plan starts.
    expect(workoutAdherence(plannedItems(params, t, "2026-08-20", "2026-09-06"), [], "2026-08-20", "2026-09-06").pct).toBeNull();
  });

  it("checklist marks checked-off vs logged workouts", async () => {
    const { params, t } = await plan();
    const first = plannedItemsForWeek(params, t, 1).filter((i) => i.kind === "strength");
    const days = weekChecklist(params, t, 1, [
      { date: first[0].date, planned_session_key: first[0].key, status: "completed", source: "checkoff" },
      { date: first[1].date, planned_session_key: first[1].key, status: "completed", source: "client_sheet" },
      { date: first[2].date, planned_session_key: first[2].key, status: "missed", source: "coach_entered" },
    ]);
    const state = (date: string) => days.find((d) => d.date === date)!.items.find((i) => i.kind === "strength")!.state;
    expect(days).toHaveLength(7);
    expect(state(first[0].date)).toBe("checked");
    expect(state(first[1].date)).toBe("logged");
    expect(state(first[2].date)).toBeNull();
    expect(sessionLabel(first[0].key, t)).toBe(t.sessions.find((s) => s.key === first[0].key)!.name);
    expect(sessionLabel(CARDIO_KEY, t)).toBe("Cardio");
  });
});
