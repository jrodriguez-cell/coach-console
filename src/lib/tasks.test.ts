import { describe, expect, it } from "vitest";
import { generateTasks, retestDate, upcomingKeyDates, type ClientSnapshot } from "./tasks";

const START = "2026-09-07"; // Monday
const snap = (over: Partial<ClientSnapshot> = {}): ClientSnapshot => ({
  client: { id: "c1", name: "Alex", status: "active", goal_category: "weight_loss", start_date: START, created_at: "2026-09-01T00:00:00Z" },
  plan: { id: "p1", status: "approved", start_date: START, weeks: 12, checkpoint_weeks: [3, 8, 11], lifting_days: [1, 3, 5], retest_weeks: [4, 8, 12], goal_category: "weight_loss" },
  intakeSubmitted: true, parqFlagged: false, clearance: null, weighIns: [START], lastContact: "2026-09-28", lastSession: "2026-09-28",
  lastActivity: null, adherence14: 90, offTrajectory: { count: 0, latestDate: null }, strengthDrops: [], energyLowDate: null,
  celebrations: [], checkinFlags: [], checkpointsDone: [], ...over,
});
const keys = (t: ReturnType<typeof generateTasks>) => t.create.map((x) => x.rule_key);

describe("task engine", () => {
  it("Sunday weigh-in due, overdue only after Monday noon", () => {
    const sun = generateTasks(snap(), "2026-09-27", 9);
    expect(keys(sun)).toContain("weigh_in_due");
    expect(keys(sun)).not.toContain("weigh_in_overdue");
    expect(keys(generateTasks(snap(), "2026-09-28", 11))).not.toContain("weigh_in_overdue");
    const mon = generateTasks(snap(), "2026-09-28", 13);
    expect(mon.create.find((t) => t.rule_key === "weigh_in_overdue")?.due_date).toBe("2026-09-28");
  });
  it("logged weigh-in resolves the weigh-in tasks", () => {
    const r = generateTasks(snap({ weighIns: [START, "2026-09-27"] }), "2026-09-28", 13);
    expect(keys(r)).not.toContain("weigh_in_due");
    expect(r.resolve.map((x) => x.rule_key)).toContain("weigh_in_overdue");
  });
  it("is idempotent (same inputs → same keys and due dates)", () => {
    const a = generateTasks(snap(), "2026-09-28", 13).create;
    const b = generateTasks(snap(), "2026-09-28", 13).create;
    expect(a).toEqual(b);
    const ids = a.map((t) => `${t.client_id}|${t.rule_key}|${t.due_date}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("week 3 calibration checkpoint (weight loss)", () => {
    const r = generateTasks(snap(), "2026-09-28", 9);
    const cal = r.create.find((t) => t.rule_key === "calibration_w3");
    expect(cal?.due_date).toBe("2026-09-27");
    expect(cal?.title).toMatch(/calibration/);
    expect(keys(generateTasks(snap({ checkpointsDone: [3] }), "2026-09-28", 9))).not.toContain("calibration_w3");
  });
  it("retest reminder the day before the retest day", () => {
    const rd = retestDate(snap().plan!, 4);
    expect(rd).toBe("2026-10-02"); // Friday of week 4
    expect(keys(generateTasks(snap(), "2026-10-01", 9))).toContain("retest_w4");
    expect(keys(generateTasks(snap(), "2026-09-30", 9))).not.toContain("retest_w4");
  });
  it("outreach after N days without contact", () => {
    expect(keys(generateTasks(snap({ lastContact: "2026-09-20" }), "2026-09-28", 9))).toContain("outreach");
    expect(keys(generateTasks(snap({ lastContact: "2026-09-25" }), "2026-09-28", 9))).not.toContain("outreach");
  });
  it("progress rules", () => {
    const r = generateTasks(snap({
      weighIns: ["2026-09-14"], adherence14: 60, offTrajectory: { count: 2, latestDate: "2026-09-27" },
      strengthDrops: [{ exercise: "Squat", date: "2026-09-25" }], energyLowDate: "2026-09-26",
      celebrations: [{ label: "PR on Squat", date: "2026-09-26" }, { label: "PR on Row", date: "2026-09-27" }], lastSession: "2026-09-18",
    }), "2026-09-28", 9);
    for (const k of ["weigh_in_missing", "adherence_low", "review_plan", "strength_drop:Squat", "energy_low", "celebrate", "training_gap"]) expect(keys(r), k).toContain(k);
    expect(r.create.filter((t) => t.rule_key === "celebrate")).toHaveLength(1);
    expect(r.create.find((t) => t.rule_key === "celebrate")?.title).toContain("PR on Squat; PR on Row");
  });
  it("strength-drop rule only for weight-loss plans", () => {
    const s = snap({ strengthDrops: [{ exercise: "Squat", date: "2026-09-25" }] });
    s.plan!.goal_category = "muscle_gain";
    expect(keys(generateTasks(s, "2026-09-28", 9))).not.toContain("strength_drop:Squat");
  });
  it("clearance follow-up after 7 days", () => {
    const r = generateTasks(snap({ parqFlagged: true, clearance: { status: "pending", requested_at: "2026-09-18" } }), "2026-09-28", 9);
    expect(r.create.find((t) => t.rule_key === "clearance_followup")?.due_date).toBe("2026-09-25");
  });
  it("prospect with no activity in 5 days", () => {
    const r = generateTasks(snap({ client: { ...snap().client, status: "prospect" }, plan: null, lastActivity: "2026-09-20", lastContact: null }), "2026-09-28", 9);
    expect(keys(r)).toEqual(["prospect_followup"]);
  });
  it("plan end: final weigh-in, renewal, and recheck for completed plans", () => {
    const end = "2026-11-29";
    expect(keys(generateTasks(snap({ lastContact: end, lastSession: end, weighIns: [end] }), end, 9))).toContain("final_weigh_in");
    expect(keys(generateTasks(snap({ lastContact: "2026-11-22", lastSession: "2026-11-22", weighIns: ["2026-11-22"] }), "2026-11-22", 9))).toContain("renewal");
    const done = snap({ client: { ...snap().client, status: "completed" } });
    expect(keys(generateTasks(done, "2027-01-03", 9))).toEqual(["recheck"]);
  });
  it("day-1 tasks", () => {
    const r = generateTasks(snap(), START, 9);
    expect(keys(r)).toEqual(expect.arrayContaining(["day1_baseline", "day1_confirm"]));
  });
  it("upcoming key dates", () => {
    const k = upcomingKeyDates(snap(), "2026-09-28", 7);
    expect(k.map((x) => x.label)).toEqual(expect.arrayContaining(["Weigh-in", "Week 4 retest"]));
  });
});
