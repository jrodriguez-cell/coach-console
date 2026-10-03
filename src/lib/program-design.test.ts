import { describe, expect, it } from "vitest";
import { chooseProgram, suggestFocus, type ProgramInput } from "./program-design";

const base: ProgramInput = { goal: "general_health", daysPerWeek: 3, level: "intermediate", deconditioned: false, age: 35, sessionLengthMin: 60, text: "" };
const pick = (p: Partial<ProgramInput>) => chooseProgram({ ...base, ...p }).split;

describe("chooseProgram", () => {
  it("varies by goal, not just days per week", () => {
    expect(pick({ daysPerWeek: 5, goal: "muscle_gain", level: "intermediate" })).toBe("ul_ppl");
    expect(pick({ daysPerWeek: 5, goal: "muscle_gain", level: "advanced" })).toBe("body_part");
    expect(pick({ daysPerWeek: 5, goal: "weight_loss" })).toBe("upper_lower");
    expect(pick({ daysPerWeek: 5, goal: "general_health" })).toBe("upper_lower");
    expect(pick({ daysPerWeek: 3, goal: "performance" })).toBe("athletic");
    expect(pick({ daysPerWeek: 3, goal: "muscle_gain" })).toBe("upper_lower_full");
    expect(pick({ daysPerWeek: 6, goal: "muscle_gain" })).toBe("ppl");
  });
  it("beginners and deconditioned clients get simpler splits", () => {
    expect(pick({ daysPerWeek: 3, goal: "muscle_gain", level: "beginner" })).toBe("full_body");
    expect(pick({ daysPerWeek: 4, level: "none" })).toBe("full_body");
    expect(pick({ daysPerWeek: 5, deconditioned: true, goal: "muscle_gain" })).toBe("upper_lower");
    expect(pick({ daysPerWeek: 6, goal: "muscle_gain", level: "beginner" })).toBe("upper_lower");
  });
  it("older clients avoid high-volume splits", () => {
    expect(pick({ daysPerWeek: 5, goal: "muscle_gain", level: "advanced", age: 64 })).toBe("upper_lower");
  });
  it("body-part split only with gym equipment", () => {
    expect(pick({ daysPerWeek: 5, goal: "muscle_gain", level: "advanced", equipment: "home_basic" })).toBe("ul_ppl");
    expect(chooseProgram({ ...base, daysPerWeek: 5, override: "body_part", equipment: "bodyweight" }).overrideIgnored).toMatch(/gym/);
  });
  it("reads strength goals from the client's words", () => {
    expect(pick({ daysPerWeek: 4, text: "I want to deadlift 2x bodyweight" })).toBe("strength");
    expect(pick({ daysPerWeek: 4, text: "get stronger", level: "beginner" })).toBe("upper_lower");
  });
  it("uses the trainer's choice when it fits the days, else explains", () => {
    expect(chooseProgram({ ...base, daysPerWeek: 4, override: "strength" })).toEqual({ split: "strength", reasons: ["Chosen by you."] });
    const c = chooseProgram({ ...base, daysPerWeek: 2, override: "ppl" });
    expect(c.split).toBe("full_body");
    expect(c.overrideIgnored).toMatch(/Push \/ pull \/ legs needs/);
  });
  it("always gives a reason", () => {
    for (const goal of ["general_health", "muscle_gain", "weight_loss", "performance"] as const)
      for (let d = 2; d <= 6; d++) expect(chooseProgram({ ...base, goal, daysPerWeek: d }).reasons.length).toBeGreaterThan(0);
  });
});

describe("suggestFocus", () => {
  it("finds up to two focus areas in the client's words", () => {
    expect(suggestFocus("Build my glutes and get toned arms")).toEqual(["glutes", "arms"]);
    expect(suggestFocus("Lose weight, feel better")).toEqual([]);
    expect(suggestFocus("glutes, legs, arms, abs").length).toBe(2);
  });
});
