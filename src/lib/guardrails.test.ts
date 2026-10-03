import { describe, expect, it } from "vitest";
import { evaluateGuardrails, guardrailApprovalIssues, worstStatus, type GuardrailInput } from "./guardrails";
import { buildEnergyModel } from "./energy";
import { computeMacroTargets, kcalFromMacros } from "./nutrition";
import { GOAL_CATEGORIES } from "@/config/goal-templates";

const byKey = (rs: ReturnType<typeof evaluateGuardrails>, k: string) => rs.find((r) => r.rule_key === k);

// CMR client: TDEE 3,221.1 from the hand-verified energy case.
const CMR: GuardrailInput = {
  goal: "weight_loss",
  targetKcal: 2200,
  tdee: 3221.1,
  proteinG: 250,
  carbG: 187.5,
  fatG: 50,
  referenceWeightLb: 270,
  predictedLbPerWeek: ((2200 - 3221.1) * 7) / 3500,
  predictedLow: -2.7,
  predictedHigh: -1.4,
  energyMode: "formula",
};

describe("CMR example: 2,200 kcal / 250 g protein / 50 g fat", () => {
  const rs = evaluateGuardrails(CMR);
  it("protein 45% of calories → warn (above 35%)", () => {
    expect(byKey(rs, "protein_pct")?.status).toBe("warn");
    expect(byKey(rs, "protein_pct")?.value).toBe("45%");
  });
  it("fat 20% → ok", () => {
    expect(byKey(rs, "fat_pct")?.status).toBe("ok");
    expect(byKey(rs, "fat_pct")?.value).toBe("20%");
  });
  it("carbs 34% → ok for weight loss", () => {
    expect(byKey(rs, "carb_pct")?.status).toBe("ok");
    expect(byKey(rs, "carb_pct")?.value).toBe("34%");
  });
  it("deficit vs TDEE above 500 → warn", () => {
    expect(byKey(rs, "calorie_deficit")?.status).toBe("warn");
  });
  it("macros reconcile", () => expect(byKey(rs, "macro_reconcile")?.status).toBe("ok"));
});

describe("hard blocks", () => {
  it("1,100 kcal is BLOCKED", () => {
    const rs = evaluateGuardrails({ ...CMR, targetKcal: 1100, proteinG: 100, carbG: 125, fatG: 25 });
    expect(byKey(rs, "calories_min")?.status).toBe("blocked");
    expect(worstStatus(rs)).toBe("blocked");
  });
  it("fat below 15% is BLOCKED, 15–20% warns", () => {
    expect(byKey(evaluateGuardrails({ ...CMR, fatG: 30, carbG: 232.5 }), "fat_pct")?.status).toBe("blocked"); // 12%
    expect(byKey(evaluateGuardrails({ ...CMR, fatG: 42, carbG: 205.5 }), "fat_pct")?.status).toBe("warn"); // 17%
  });
  it("measured TDEE 2,926 with no baseline exercise → BLOCKED", () => {
    const m = buildEnergyModel({
      mode: "measured", sex: "male", age: 36, heightCm: 190.5, weightKg: 122.47, bmrMethod: "mifflin", neatFactor: 1.2,
      loads: [{ category: "strength", label: "Lift", met: 3.5, minutes: 55, perWeek: 4 }], deficit: 400, measured: { tdee: 2926, days: 21 },
    });
    const rs = evaluateGuardrails({ ...CMR, energyMode: "measured", baselineMissing: m.baseline_missing, tdee: m.tdee });
    expect(byKey(rs, "measured_baseline")?.status).toBe("blocked");
  });
  it("macros that don't reconcile are blocked", () => {
    expect(byKey(evaluateGuardrails({ ...CMR, carbG: 150 }), "macro_reconcile")?.status).toBe("blocked");
  });
});

describe("rates, protein conflicts, cardio", () => {
  it("weight-loss pace above 2 lb/week warns", () => {
    expect(byKey(evaluateGuardrails({ ...CMR, predictedLbPerWeek: -2.5 }), "weekly_loss_rate")?.status).toBe("warn");
    expect(byKey(evaluateGuardrails({ ...CMR, predictedLbPerWeek: -1.5 }), "weekly_loss_rate")?.status).toBe("ok");
  });
  it("muscle gain surplus and monthly rate", () => {
    const rs = evaluateGuardrails({ ...CMR, goal: "muscle_gain", targetKcal: 3421, tdee: 3221, proteinG: 230, fatG: 95, carbG: (3421 - 920 - 855) / 4, predictedLbPerWeek: (200 * 7) / 3500, predictedLow: 0.1, predictedHigh: 0.7 });
    expect(byKey(rs, "calorie_surplus")?.status).toBe("ok");
    expect(byKey(rs, "monthly_gain_rate")?.status).toBe("ok"); // 1.74 lb/month
  });
  it("prediction spanning zero warns", () => {
    expect(byKey(evaluateGuardrails({ ...CMR, predictedLow: -0.4, predictedHigh: 0.2 }), "prediction_spans_zero")?.status).toBe("warn");
  });
  it("protein infeasible (heavy client at low calories) warns and explains", () => {
    const rs = evaluateGuardrails({ ...CMR, referenceWeightLb: 400, targetKcal: 1800, proteinG: 157, fatG: 40, carbG: (1800 - 628 - 360) / 4 });
    expect(byKey(rs, "protein_infeasible")?.status).toBe("warn");
  });
  it("cardio removed requires an override", () => {
    const rs = evaluateGuardrails({ ...CMR, cardio: { sessionsPerWeek: 0, minutesPerSession: 0, removed: true } });
    expect(byKey(rs, "cardio_removed")?.status).toBe("warn");
  });
  it("cardio outside the goal range warns", () => {
    expect(byKey(evaluateGuardrails({ ...CMR, cardio: { sessionsPerWeek: 2, minutesPerSession: 30, removed: false } }), "cardio_prescription")?.status).toBe("warn");
    expect(byKey(evaluateGuardrails({ ...CMR, cardio: { sessionsPerWeek: 3, minutesPerSession: 30, removed: false } }), "cardio_prescription")?.status).toBe("ok");
  });
});

describe("approval gate", () => {
  it("warns need non-empty reasons; blocked can never pass", () => {
    const rs = evaluateGuardrails(CMR);
    const warns = rs.filter((r) => r.status === "warn");
    expect(guardrailApprovalIssues(rs, []).length).toBe(warns.length);
    expect(guardrailApprovalIssues(rs, warns.map((w) => ({ rule_key: w.rule_key, reason: "  " }))).length).toBe(warns.length);
    expect(guardrailApprovalIssues(rs, warns.map((w) => ({ rule_key: w.rule_key, reason: "Client's physician approved" })))).toEqual([]);
    const blocked = evaluateGuardrails({ ...CMR, targetKcal: 1100, proteinG: 100, carbG: 125, fatG: 25 });
    expect(guardrailApprovalIssues(blocked, blocked.map((w) => ({ rule_key: w.rule_key, reason: "x" }))).some((s) => s.startsWith("Blocked"))).toBe(true);
  });
});

describe("macro reconciliation for generated targets", () => {
  it("4P + 4C + 9F is within 2 kcal of the target across a grid of inputs", () => {
    for (const goal of GOAL_CATEGORIES) {
      for (let kcal = 1200; kcal <= 4500; kcal += 37) {
        for (const w of [110, 150, 205, 270, 340]) {
          for (const sex of ["male", "female"] as const) {
            const t = computeMacroTargets({ goal, calories: kcal + 0.37, referenceWeightLb: w, sex });
            expect(Math.abs(kcalFromMacros(t.protein_g, t.carbs_g, t.fat_g) - t.calories)).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

describe("carb % at the display boundary (JR, muscle gain)", () => {
  const base: GuardrailInput = { ...CMR, goal: "muscle_gain", targetKcal: 2631, tdee: 2431, proteinG: 197, fatG: 73, predictedLbPerWeek: 0.4, predictedLow: -0.2, predictedHigh: 1.0, energyMode: "measured", measuredBaselineKcal: 186 } as GuardrailInput;
  it("44.9% shows as 45% and is not flagged against a 45% minimum", () => {
    const r = byKey(evaluateGuardrails({ ...base, carbG: 295 }), "carb_pct");
    expect(r?.value).toBe("45%");
    expect(r?.status).toBe("ok");
  });
  it("a genuinely low value (44%) is still flagged", () => {
    const r = byKey(evaluateGuardrails({ ...base, carbG: 289 }), "carb_pct");
    expect(r?.value).toBe("44%");
    expect(r?.status).toBe("warn");
  });
});
