import { describe, expect, it } from "vitest";
import { parseTime, validateEntry } from "./metrics";

const weight = { key: "weight_lb", label: "Weight", type: "number" as const, unit: "lb" };

describe("metric entry validation", () => {
  it("accepts a plausible weight", () => {
    const r = validateEntry({ metric: weight, raw: "201.4", date: "2026-09-28", previous: { date: "2026-09-21", value_num: 203 } });
    expect(r.ok).toBe(true);
    expect(r.value_num).toBe(201.4);
  });
  it("warns and asks for confirmation on a >5 lb change in a day", () => {
    const r = validateEntry({ metric: weight, raw: "195", date: "2026-09-28", previous: { date: "2026-09-27", value_num: 201 } });
    expect(r.ok).toBe(false);
    expect(r.needsConfirmation).toBe(true);
    expect(validateEntry({ metric: weight, raw: "195", date: "2026-09-28", previous: { date: "2026-09-27", value_num: 201 }, confirmed: true }).ok).toBe(true);
  });
  it("never silently overwrites: shows the old value and asks", () => {
    const r = validateEntry({ metric: weight, raw: "200", date: "2026-09-28", existing: { value_num: 201, value_text: null } });
    expect(r.needsConfirmation).toBe(true);
    expect(r.warnings[0]).toContain("201");
    // same value is not a conflict
    expect(validateEntry({ metric: weight, raw: "201", date: "2026-09-28", existing: { value_num: 201, value_text: null } }).ok).toBe(true);
  });
  it("rejects implausible and malformed values", () => {
    expect(validateEntry({ metric: weight, raw: "20", date: "2026-09-28" }).errors.length).toBe(1);
    expect(validateEntry({ metric: weight, raw: "abc", date: "2026-09-28" }).errors.length).toBe(1);
    expect(validateEntry({ metric: { key: "energy_1_10", label: "Energy", type: "scale_1_10", unit: null }, raw: "11", date: "2026-09-28" }).ok).toBe(false);
    expect(validateEntry({ metric: { key: "x", label: "Stretched", type: "boolean", unit: null }, raw: "yes", date: "2026-09-28" }).value_num).toBe(1);
  });
  it("parses times", () => {
    expect(parseTime("25:30")).toBeCloseTo(25.5, 9);
    expect(parseTime("1:02:00")).toBeCloseTo(62, 9);
    expect(parseTime("30")).toBe(30);
    expect(parseTime("x")).toBeNull();
  });
});
