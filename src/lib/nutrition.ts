/**
 * Deterministic calorie and macro targets. Every number shown in a plan's
 * nutrition section comes from here (or from the example-day solver, which is
 * checked against these tolerances).
 */
import { GUARDRAIL_DEFAULTS, type GuardrailLimits } from "@/config/guardrails";
import { CALORIE_TOLERANCE_FRACTION, CARB_TOLERANCE_G, FAT_TOLERANCE_G, PROTEIN_TOLERANCE_G } from "@/config/energy";
import type { GoalCategory } from "@/config/goal-templates";

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
  protein_g_per_lb: number;
  reference_weight_lb: number;
  tolerance: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  /** set when no protein value satisfies both g/lb and % limits */
  protein_conflict: string | null;
  fiber_g: number;
  water: WaterGuidance;
}

export interface WaterGuidance {
  total_fl_oz: number;
  from_drinks_fl_oz: number;
  text: string;
}

export const DEFAULT_PROTEIN_G_PER_LB: Record<GoalCategory, number> = {
  weight_loss: 0.85,
  muscle_gain: 0.85,
  general_health: 0.8,
  performance: 0.8,
};

export const DEFAULT_FAT_PCT: Record<GoalCategory, number> = {
  weight_loss: 20,
  muscle_gain: 25,
  general_health: 25,
  performance: 27,
};

export function kcalFromMacros(p: number, c: number, f: number): number {
  return 4 * p + 4 * c + 9 * f;
}

export function pctOfCalories(grams: number, kcalPerGram: number, calories: number): number {
  return calories > 0 ? ((grams * kcalPerGram) / calories) * 100 : 0;
}

/**
 * Choose protein grams inside [g/lb min, g/lb max] ∩ [%min, %max] of calories.
 * If the intersection is empty, pick the %-feasible value closest to the
 * g/lb range and explain.
 */
export function chooseProtein(p: {
  calories: number;
  referenceWeightLb: number;
  gPerLb: number;
  limits?: GuardrailLimits;
}): { grams: number; conflict: string | null } {
  const L = p.limits ?? GUARDRAIL_DEFAULTS;
  const lbLo = L.proteinGPerLbMin * p.referenceWeightLb;
  const lbHi = L.proteinGPerLbMax * p.referenceWeightLb;
  const pctLo = (L.proteinPctMin / 100) * p.calories / 4;
  const pctHi = (L.proteinPctMax / 100) * p.calories / 4;
  const lo = Math.max(lbLo, pctLo);
  const hi = Math.min(lbHi, pctHi);
  const desired = p.gPerLb * p.referenceWeightLb;
  if (lo <= hi) {
    return { grams: Math.min(hi, Math.max(lo, desired)), conflict: null };
  }
  // Infeasible: stay inside the % band, as close to the g/lb band as possible.
  const grams = lbLo > pctHi ? pctHi : pctLo;
  const conflict =
    lbLo > pctHi
      ? `At ${Math.round(p.calories)} kcal, ${L.proteinGPerLbMin} g/lb of ${Math.round(p.referenceWeightLb)} lb (${Math.round(lbLo)} g) would exceed ${L.proteinPctMax}% of calories (max ${Math.round(pctHi)} g). Consider using goal weight as the reference weight.`
      : `At ${Math.round(p.calories)} kcal, ${L.proteinGPerLbMax} g/lb of ${Math.round(p.referenceWeightLb)} lb (${Math.round(lbHi)} g) is below ${L.proteinPctMin}% of calories (min ${Math.round(pctLo)} g).`;
  return { grams, conflict };
}

export function fiberGrams(calories: number): number {
  return Math.round((14 * calories) / 1000);
}

export function waterGuidance(sex: "male" | "female", limits: GuardrailLimits = GUARDRAIL_DEFAULTS): WaterGuidance {
  const total = sex === "male" ? limits.waterFlOzMax : limits.waterFlOzMin;
  const drinks = Math.round(total * (1 - limits.waterFromFoodFraction));
  return {
    total_fl_oz: total,
    from_drinks_fl_oz: drinks,
    text: `Aim for about ${total} fl oz of total fluids per day (guidance range ${limits.waterFlOzMin}–${limits.waterFlOzMax} fl oz); roughly 20% comes from food, so about ${drinks} fl oz from drinks. Add more around training and in heat.`,
  };
}

export interface MacroInput {
  goal: GoalCategory;
  calories: number;
  referenceWeightLb: number;
  sex: "male" | "female";
  proteinGPerLb?: number | null;
  fatPct?: number | null;
  limits?: GuardrailLimits;
}

/**
 * Point targets + tolerance bands. Calories, protein and fat are rounded to
 * whole numbers; carbs are the remainder, so 4P + 4C + 9F reconciles with the
 * calorie target within 2 kcal.
 */
export function computeMacroTargets(input: MacroInput): MacroTargets {
  const L = input.limits ?? GUARDRAIL_DEFAULTS;
  const calories = Math.round(input.calories);
  const gPerLb = input.proteinGPerLb ?? DEFAULT_PROTEIN_G_PER_LB[input.goal];
  const { grams: proteinRaw, conflict } = chooseProtein({ calories, referenceWeightLb: input.referenceWeightLb, gPerLb, limits: L });
  // Round toward the inside of the guardrail band so rounding never creates a warning.
  const pLo = Math.max(L.proteinGPerLbMin * input.referenceWeightLb, ((L.proteinPctMin / 100) * calories) / 4);
  const pHi = Math.min(L.proteinGPerLbMax * input.referenceWeightLb, ((L.proteinPctMax / 100) * calories) / 4);
  let protein = Math.round(proteinRaw);
  if (!conflict && protein > pHi) protein = Math.floor(pHi);
  if (!conflict && protein < pLo) protein = Math.ceil(pLo);
  const fatPct = Math.max(input.fatPct ?? DEFAULT_FAT_PCT[input.goal], 0);
  const fatExact = ((fatPct / 100) * calories) / 9;
  let fat = Math.round(fatExact);
  if (fatPct >= L.fatPctMin && (fat * 9 * 100) / calories < L.fatPctMin) fat = Math.ceil(fatExact);
  const carbs = Math.max(0, Math.round((calories - 4 * protein - 9 * fat) / 4));
  return {
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    protein_pct: pctOfCalories(protein, 4, calories),
    carbs_pct: pctOfCalories(carbs, 4, calories),
    fat_pct: pctOfCalories(fat, 9, calories),
    protein_g_per_lb: protein / input.referenceWeightLb,
    reference_weight_lb: input.referenceWeightLb,
    tolerance: {
      calories: Math.round(calories * CALORIE_TOLERANCE_FRACTION),
      protein_g: PROTEIN_TOLERANCE_G,
      carbs_g: CARB_TOLERANCE_G,
      fat_g: FAT_TOLERANCE_G,
    },
    protein_conflict: conflict,
    fiber_g: fiberGrams(calories),
    water: waterGuidance(input.sex, L),
  };
}

/**
 * Re-derive targets after the trainer edits one value (grams), keeping the
 * calorie total fixed and recomputing carbs as the remainder.
 */
export function withEditedMacros(t: MacroTargets, edits: { protein_g?: number; fat_g?: number; calories?: number }): MacroTargets {
  const calories = Math.round(edits.calories ?? t.calories);
  const protein = Math.round(edits.protein_g ?? t.protein_g);
  const fat = Math.round(edits.fat_g ?? t.fat_g);
  const carbs = Math.max(0, Math.round((calories - 4 * protein - 9 * fat) / 4));
  return {
    ...t,
    calories,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    protein_pct: pctOfCalories(protein, 4, calories),
    carbs_pct: pctOfCalories(carbs, 4, calories),
    fat_pct: pctOfCalories(fat, 9, calories),
    protein_g_per_lb: protein / t.reference_weight_lb,
    tolerance: { ...t.tolerance, calories: Math.round(calories * CALORIE_TOLERANCE_FRACTION) },
    fiber_g: fiberGrams(calories),
  };
}

export function withinBand(value: number, target: number, tol: number): boolean {
  return Math.abs(value - target) <= tol;
}
