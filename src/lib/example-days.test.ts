import { describe, expect, it } from "vitest";
import { FOODS } from "@/data/foods";
import { allowedFoods, buildExampleDays, formatQty, householdText, swapTable } from "./example-days";
import { computeMacroTargets, kcalFromMacros } from "./nutrition";
import type { LibFood } from "./plan-types";
import { GOAL_CATEGORIES } from "@/config/goal-templates";

const LIB: LibFood[] = FOODS.map((f) => ({ ...f, id: f.slug, slug: f.slug }));

describe("food filtering", () => {
  it("removes allergens, patterns and excluded foods", () => {
    const a = allowedFoods(LIB, { dietaryPattern: "vegan", allergies: ["peanut"], excluded: ["tofu"] });
    expect(a.some((f) => f.allergens.includes("peanut"))).toBe(false);
    expect(a.every((f) => f.dietary_tags.includes("vegan"))).toBe(true);
    expect(a.some((f) => f.name.toLowerCase().includes("tofu"))).toBe(false);
  });
  it("gluten allergy also removes wheat", () => {
    const a = allowedFoods(LIB, { dietaryPattern: "omnivore", allergies: ["gluten"], excluded: [] });
    expect(a.some((f) => f.allergens.includes("wheat"))).toBe(false);
  });
});

describe("household measures", () => {
  it("formats fractions", () => {
    expect(formatQty(1.5)).toBe("1 ½");
    expect(formatQty(0.25)).toBe("¼");
    expect(formatQty(2)).toBe("2");
  });
  it("uses tsp for small tbsp amounts and oz for meats", () => {
    const oil = LIB.find((f) => f.slug === "olive_oil")!;
    expect(householdText(oil, 5)).toBe("1 tsp");
    const chicken = LIB.find((f) => f.slug === "chicken_breast")!;
    expect(householdText(chicken, 170)).toBe("6 oz cooked");
  });
});

describe("example days land inside every tolerance band", () => {
  const cases = [
    { goal: "weight_loss" as const, kcal: 2721, w: 270, sex: "male" as const, pattern: "omnivore" as const, meals: 3 },
    { goal: "weight_loss" as const, kcal: 1500, w: 165, sex: "female" as const, pattern: "omnivore" as const, meals: 4 },
    { goal: "muscle_gain" as const, kcal: 3200, w: 180, sex: "male" as const, pattern: "omnivore" as const, meals: 5 },
    { goal: "performance" as const, kcal: 2900, w: 160, sex: "female" as const, pattern: "vegetarian" as const, meals: 4 },
    { goal: "general_health" as const, kcal: 2000, w: 150, sex: "female" as const, pattern: "vegan" as const, meals: 3 },
    { goal: "general_health" as const, kcal: 2400, w: 190, sex: "male" as const, pattern: "pescatarian" as const, meals: 2 },
  ];
  for (const c of cases) {
    it(`${c.goal} ${c.kcal} kcal ${c.pattern} ${c.meals} meals`, () => {
      const t = computeMacroTargets({ goal: c.goal, calories: c.kcal, referenceWeightLb: c.w, sex: c.sex });
      const days = buildExampleDays({ foods: LIB, targets: t, mealsPerDay: c.meals, prefs: { dietaryPattern: c.pattern, allergies: [], excluded: [] } });
      expect(days.length).toBeGreaterThanOrEqual(3);
      for (const d of days) {
        expect(Math.abs(d.totals.calories - t.calories)).toBeLessThanOrEqual(t.tolerance.calories);
        expect(Math.abs(d.totals.protein_g - t.protein_g)).toBeLessThanOrEqual(t.tolerance.protein_g + 0.5);
        expect(Math.abs(d.totals.carbs_g - t.carbs_g)).toBeLessThanOrEqual(t.tolerance.carbs_g + 0.5);
        expect(Math.abs(d.totals.fat_g - t.fat_g)).toBeLessThanOrEqual(t.tolerance.fat_g + 0.5);
        expect(d.label).toContain("example, swap freely");
        for (const m of d.meals) for (const i of m.items) expect(i.household.length).toBeGreaterThan(0);
      }
      expect(Math.abs(kcalFromMacros(t.protein_g, t.carbs_g, t.fat_g) - t.calories)).toBeLessThanOrEqual(2);
    });
  }
});

describe("swap table", () => {
  it("lists equivalent portions", () => {
    const rows = swapTable(LIB);
    expect(rows.map((r) => r.basis)).toEqual(["protein", "carbs", "fat"]);
    const chicken = rows[0].options.find((o) => o.name.startsWith("Chicken breast"));
    expect(chicken?.grams).toBe(95); // 30 g protein / 0.31
  });
});

void GOAL_CATEGORIES;
