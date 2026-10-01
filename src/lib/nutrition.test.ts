import { describe, expect, it } from "vitest";
import { chooseProtein, computeMacroTargets, fiberGrams, kcalFromMacros, waterGuidance, withEditedMacros } from "./nutrition";
import { evaluateGuardrails } from "./guardrails";

describe("macro targets", () => {
  it("weight loss defaults: 0.85 g/lb protein, 20% fat, carbs remainder", () => {
    const t = computeMacroTargets({ goal: "weight_loss", calories: 2721.1, referenceWeightLb: 270, sex: "male" });
    expect(t.calories).toBe(2721);
    expect(t.protein_g).toBe(230); // 229.5 → 230
    expect(t.fat_g).toBe(61); // 20% of 2721 / 9 = 60.47; rounded up so fat stays ≥ 20%
    expect(t.carbs_g).toBe(Math.round((2721 - 920 - 549) / 4));
    expect(Math.abs(kcalFromMacros(t.protein_g, t.carbs_g, t.fat_g) - t.calories)).toBeLessThanOrEqual(2);
    expect(t.tolerance).toEqual({ calories: 136, protein_g: 10, carbs_g: 15, fat_g: 5 });
  });

  it("default targets pass protein/carb/fat guardrails for a typical client", () => {
    const t = computeMacroTargets({ goal: "general_health", calories: 2200, referenceWeightLb: 165, sex: "female" });
    const rs = evaluateGuardrails({ goal: "general_health", targetKcal: t.calories, tdee: 2200, proteinG: t.protein_g, carbG: t.carbs_g, fatG: t.fat_g, referenceWeightLb: 165, predictedLbPerWeek: 0, predictedLow: -0.4, predictedHigh: 0.4, energyMode: "formula" });
    for (const k of ["protein_per_lb", "protein_pct", "carb_pct", "fat_pct", "macro_reconcile"]) {
      expect(rs.find((r) => r.rule_key === k)?.status, k).toBe("ok");
    }
  });

  it("rounding never pushes fat below 20% or protein outside its band", () => {
    for (let kcal = 1200; kcal <= 4000; kcal += 13) {
      const t = computeMacroTargets({ goal: "weight_loss", calories: kcal, referenceWeightLb: 200, sex: "male" });
      expect(t.fat_pct).toBeGreaterThanOrEqual(20);
      if (!t.protein_conflict) {
        expect(t.protein_pct).toBeLessThanOrEqual(35);
        expect(t.protein_pct).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("protein is clamped to 35% of calories when g/lb would exceed it", () => {
    const r = chooseProtein({ calories: 1800, referenceWeightLb: 400, gPerLb: 0.85 });
    expect(r.grams).toBeCloseTo(157.5, 6);
    expect(r.conflict).toMatch(/goal weight/);
  });

  it("protein stays within both limits when feasible", () => {
    const r = chooseProtein({ calories: 2500, referenceWeightLb: 180, gPerLb: 0.85 });
    expect(r.grams).toBeCloseTo(153, 6);
    expect(r.conflict).toBeNull();
  });

  it("editing protein recomputes carbs and keeps reconciliation", () => {
    const t = computeMacroTargets({ goal: "muscle_gain", calories: 3100, referenceWeightLb: 180, sex: "male" });
    const e = withEditedMacros(t, { protein_g: 170 });
    expect(e.protein_g).toBe(170);
    expect(Math.abs(kcalFromMacros(e.protein_g, e.carbs_g, e.fat_g) - e.calories)).toBeLessThanOrEqual(2);
  });

  it("fiber 14 g / 1,000 kcal and water by sex", () => {
    expect(fiberGrams(2000)).toBe(28);
    expect(waterGuidance("male").total_fl_oz).toBe(125);
    expect(waterGuidance("female").total_fl_oz).toBe(91);
    expect(waterGuidance("female").from_drinks_fl_oz).toBe(73);
  });
});
