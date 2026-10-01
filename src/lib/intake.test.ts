import { describe, expect, it } from "vitest";
import { blockedSections, clearanceIssue, isDeconditioned, parqFlagged, PARQ_QUESTIONS } from "./intake";

describe("PAR-Q", () => {
  it("has the 7 standard questions and flags on any yes", () => {
    expect(PARQ_QUESTIONS.length).toBe(7);
    expect(parqFlagged([false, false, false, false, false, false, false])).toBe(false);
    expect(parqFlagged([false, false, false, false, false, true, false])).toBe(true);
  });
  it("approval needs clearance status when flagged", () => {
    expect(clearanceIssue(false, null)).toBeNull();
    expect(clearanceIssue(true, null)).toMatch(/record physician clearance/);
    expect(clearanceIssue(true, { status: "pending" })).toMatch(/pending/);
    expect(clearanceIssue(true, { status: "received", notes: "" })).toMatch(/notes/);
    expect(clearanceIssue(true, { status: "received", notes: "HR ceiling 140" })).toBeNull();
    expect(clearanceIssue(true, { status: "not_required", reason: "" })).toMatch(/reason/);
    expect(clearanceIssue(true, { status: "not_required", reason: "Answer was about a resolved ankle sprain, confirmed by physician letter" })).toBeNull();
  });
});

describe("refer-out", () => {
  it("blocks nutrition for eating-disorder/medical and training for acute injury", () => {
    const b = blockedSections({ eating_disorder: true, medical_condition: true, acute_injury: true, mental_health: true, injury: true }, []);
    expect(b.nutrition.sort()).toEqual(["eating_disorder", "medical_condition"]);
    expect(b.training).toEqual(["acute_injury"]);
  });
  it("unblocks once handling is recorded", () => {
    const b = blockedSections({ eating_disorder: true, acute_injury: true }, [
      { flag: "eating_disorder", handled_note: "Referred to RD" },
      { flag: "acute_injury", handled_note: "  " },
    ]);
    expect(b.nutrition).toEqual([]);
    expect(b.training).toEqual(["acute_injury"]);
  });
  it("deconditioned heuristic", () => {
    expect(isDeconditioned({ deconditioned: false, training_history: "none", activity_level: "physical_job" })).toBe(true);
    expect(isDeconditioned({ deconditioned: false, training_history: "beginner", activity_level: "sedentary" })).toBe(true);
    expect(isDeconditioned({ deconditioned: false, training_history: "intermediate", activity_level: "sedentary" })).toBe(false);
  });
});
