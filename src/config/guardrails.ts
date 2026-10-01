/**
 * Default guardrail limits (ISSA CPT textbook). Editable in Settings; the
 * settings row "guardrail_limits" is merged over these at runtime.
 */
export const GUARDRAIL_DEFAULTS = {
  minCalories: 1200, // BLOCKED below — physician-supervised territory
  deficitMin: 200,
  deficitMax: 500,
  surplusMin: 200,
  surplusMax: 500,
  lossLbPerWeekMin: 1,
  lossLbPerWeekMax: 2,
  gainLbPerMonthMin: 1,
  gainLbPerMonthMax: 2,
  /** For general health / performance, warn if |balance| exceeds this. */
  maintenanceBalanceMax: 500,
  proteinGPerLbMin: 0.7,
  proteinGPerLbMax: 1.0,
  proteinPctMin: 10,
  proteinPctMax: 35,
  carbPctMin: 45,
  carbPctMax: 65,
  carbPctMinWeightLoss: 25,
  fatPctMin: 20,
  fatPctMax: 35,
  fatPctBlocked: 15,
  waterFlOzMin: 91,
  waterFlOzMax: 125,
  waterFromFoodFraction: 0.2,
};
export type GuardrailLimits = typeof GUARDRAIL_DEFAULTS;
