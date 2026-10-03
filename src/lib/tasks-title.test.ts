import { describe, expect, it } from "vitest";
import { shortTaskTitle } from "./tasks";

const N = "Sample Client A (weight loss)";
describe("shortTaskTitle", () => {
  it.each([
    [`${N}: week 3 — run calibration and decide calorie level`, "Week 3 — run calibration and decide calorie level"],
    [`Reach out to ${N}`, "Reach out"],
    [`Celebrate with ${N}: PR on Goblet Squat`, "Celebrate: PR on Goblet Squat"],
    [`Weigh-in due: ${N}`, "Weigh-in due"],
    [`Text ${N} for weigh-in`, "Text client for weigh-in"],
    [`Day 1: baseline weigh-in and measurements for ${N}`, "Day 1: baseline weigh-in and measurements"],
    [`Adherence check-in with ${N} (62% over 14 days)`, "Adherence check-in (62% over 14 days)"],
    [`Follow up with ${N} / physician office on clearance`, "Follow up with physician office on clearance"],
    [`Follow up with prospect ${N}`, "Follow up"],
    ["Call the gym about rack time", "Call the gym about rack time"],
  ])("%s", (input, out) => expect(shortTaskTitle(input, N)).toBe(out));
  it("leaves titles alone without a client name", () => expect(shortTaskTitle(`Reach out to ${N}`, null)).toBe(`Reach out to ${N}`));
});
