/**
 * Guardrail engine. Defaults come from the ISSA CPT textbook
 * (src/config/guardrails.ts, editable in Settings).
 *
 *  ok      – within limits
 *  warn    – trainer may proceed only after recording an override reason
 *  blocked – cannot be overridden; the plan cannot be approved
 */
import { GUARDRAIL_DEFAULTS, type GuardrailLimits } from "@/config/guardrails";
import { GOAL_TEMPLATES, type GoalCategory } from "@/config/goal-templates";
import { kcalFromMacros, pctOfCalories } from "./nutrition";

export type GuardrailStatus = "ok" | "warn" | "blocked";

export interface GuardrailResult {
  rule_key: string;
  label: string;
  status: GuardrailStatus;
  message: string;
  value?: string;
}

export interface GuardrailInput {
  goal: GoalCategory;
  targetKcal: number;
  tdee: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  referenceWeightLb: number;
  predictedLbPerWeek: number;
  predictedLow: number;
  predictedHigh: number;
  energyMode: "formula" | "measured";
  baselineMissing?: boolean;
  measuredWindowShort?: boolean;
  cardio?: { sessionsPerWeek: number; minutesPerSession: number; removed: boolean } | null;
  limits?: Partial<GuardrailLimits>;
}

const fmt = (n: number, d = 0) => n.toFixed(d);

export function evaluateGuardrails(input: GuardrailInput): GuardrailResult[] {
  const L: GuardrailLimits = { ...GUARDRAIL_DEFAULTS, ...(input.limits ?? {}) };
  const out: GuardrailResult[] = [];
  const add = (r: GuardrailResult) => out.push(r);
  const cal = input.targetKcal;

  // --- Calories floor -------------------------------------------------------
  add(
    cal < L.minCalories
      ? { rule_key: "calories_min", label: "Minimum calories", status: "blocked", value: `${fmt(cal)} kcal`, message: `Target ${fmt(cal)} kcal is below ${L.minCalories} kcal/day. Lower intakes are physician-supervised territory and cannot be approved.` }
      : { rule_key: "calories_min", label: "Minimum calories", status: "ok", value: `${fmt(cal)} kcal`, message: `At or above ${L.minCalories} kcal/day.` },
  );

  // --- Energy balance vs goal ----------------------------------------------
  // Whole kcal: targets are rounded to integers, so compare rounded balances.
  const deficit = Math.round(input.tdee - cal);
  if (input.goal === "weight_loss") {
    const ok = deficit >= L.deficitMin && deficit <= L.deficitMax;
    add({ rule_key: "calorie_deficit", label: "Calorie deficit", status: ok ? "ok" : "warn", value: `${fmt(deficit)} kcal/day`, message: ok ? `Deficit within ${L.deficitMin}–${L.deficitMax} kcal/day.` : `Deficit of ${fmt(deficit)} kcal/day vs. estimated TDEE is outside ${L.deficitMin}–${L.deficitMax} kcal/day.` });
    const loss = -input.predictedLbPerWeek;
    const okRate = loss >= L.lossLbPerWeekMin && loss <= L.lossLbPerWeekMax;
    add({ rule_key: "weekly_loss_rate", label: "Planned weekly loss", status: okRate ? "ok" : "warn", value: `${fmt(loss, 2)} lb/week`, message: okRate ? `Planned loss within ${L.lossLbPerWeekMin}–${L.lossLbPerWeekMax} lb/week.` : `Planned loss of ${fmt(loss, 2)} lb/week is outside ${L.lossLbPerWeekMin}–${L.lossLbPerWeekMax} lb/week.` });
  } else if (input.goal === "muscle_gain") {
    const surplus = -deficit;
    const ok = surplus >= L.surplusMin && surplus <= L.surplusMax;
    add({ rule_key: "calorie_surplus", label: "Calorie surplus", status: ok ? "ok" : "warn", value: `${fmt(surplus)} kcal/day`, message: ok ? `Surplus within ${L.surplusMin}–${L.surplusMax} kcal/day.` : `Surplus of ${fmt(surplus)} kcal/day is outside ${L.surplusMin}–${L.surplusMax} kcal/day.` });
    const perMonth = input.predictedLbPerWeek * (30.44 / 7);
    const okRate = perMonth >= L.gainLbPerMonthMin && perMonth <= L.gainLbPerMonthMax;
    add({ rule_key: "monthly_gain_rate", label: "Expected monthly gain", status: okRate ? "ok" : "warn", value: `${fmt(perMonth, 1)} lb/month`, message: okRate ? `Expected gain within ${L.gainLbPerMonthMin}–${L.gainLbPerMonthMax} lb/month.` : `Expected gain of ${fmt(perMonth, 1)} lb/month is outside ${L.gainLbPerMonthMin}–${L.gainLbPerMonthMax} lb/month.` });
  } else {
    const ok = Math.abs(deficit) <= L.maintenanceBalanceMax;
    add({ rule_key: "calorie_balance", label: "Calorie balance", status: ok ? "ok" : "warn", value: `${fmt(-deficit)} kcal/day`, message: ok ? `Balance within ±${L.maintenanceBalanceMax} kcal/day of estimated TDEE.` : `Balance of ${fmt(-deficit)} kcal/day is more than ${L.maintenanceBalanceMax} kcal/day from estimated TDEE.` });
    if (-input.predictedLbPerWeek > L.lossLbPerWeekMax) {
      add({ rule_key: "energy_loss_pace", label: "Exercise + deficit pace", status: "warn", value: `${fmt(-input.predictedLbPerWeek, 2)} lb/week`, message: `Planned exercise energy plus the deficit would drive a loss above ${L.lossLbPerWeekMax} lb/week.` });
    }
  }

  // --- Energy model integrity ----------------------------------------------
  if (input.energyMode === "measured") {
    add(
      input.baselineMissing
        ? { rule_key: "measured_baseline", label: "Measured TDEE baseline", status: "blocked", message: "Measured-mode TDEE was entered without the client's current baseline exercise. Adding the program on top would double-count exercise. Enter current weekly sessions/minutes (or wearable active calories) first." }
        : { rule_key: "measured_baseline", label: "Measured TDEE baseline", status: "ok", message: "Baseline exercise supplied; only the program's increase is added." },
    );
    if (input.measuredWindowShort) {
      add({ rule_key: "measured_window", label: "Measured TDEE window", status: "warn", message: "Measured TDEE averages fewer than 14 days; the estimate may be unreliable." });
    }
  }
  const spansZero = input.predictedLow < 0 && input.predictedHigh > 0;
  if (spansZero && Math.abs(input.targetKcal - input.tdee) > 1) {
    add({ rule_key: "prediction_spans_zero", label: "Prediction uncertainty", status: "warn", value: `${fmt(input.predictedHigh, 1)} to ${fmt(input.predictedLow, 1)} lb/week`, message: "The uncertainty band on the expected weekly change spans zero: the client might not move in the intended direction. Recalibrate from weigh-ins." });
  }

  // --- Protein --------------------------------------------------------------
  const gPerLb = input.proteinG / input.referenceWeightLb;
  const pPct = pctOfCalories(input.proteinG, 4, cal);
  const okLb = gPerLb >= L.proteinGPerLbMin - 1e-9 && gPerLb <= L.proteinGPerLbMax + 1e-9;
  const okPct = pPct >= L.proteinPctMin && pPct <= L.proteinPctMax;
  add({ rule_key: "protein_per_lb", label: "Protein per lb", status: okLb ? "ok" : "warn", value: `${fmt(gPerLb, 2)} g/lb`, message: okLb ? `Within ${L.proteinGPerLbMin}–${L.proteinGPerLbMax} g/lb of reference weight.` : `${fmt(gPerLb, 2)} g/lb is outside ${L.proteinGPerLbMin}–${L.proteinGPerLbMax} g/lb of reference weight (${fmt(input.referenceWeightLb)} lb).` });
  add({ rule_key: "protein_pct", label: "Protein % of calories", status: okPct ? "ok" : "warn", value: `${fmt(pPct)}%`, message: okPct ? `Within ${L.proteinPctMin}–${L.proteinPctMax}% of calories.` : `Protein is ${fmt(pPct)}% of calories, outside ${L.proteinPctMin}–${L.proteinPctMax}%.` });
  const lbLo = L.proteinGPerLbMin * input.referenceWeightLb;
  const lbHi = L.proteinGPerLbMax * input.referenceWeightLb;
  const pctLo = ((L.proteinPctMin / 100) * cal) / 4;
  const pctHi = ((L.proteinPctMax / 100) * cal) / 4;
  if (Math.max(lbLo, pctLo) > Math.min(lbHi, pctHi)) {
    add({ rule_key: "protein_infeasible", label: "Protein limits conflict", status: "warn", message: `No protein amount satisfies both ${L.proteinGPerLbMin}–${L.proteinGPerLbMax} g/lb (${fmt(lbLo)}–${fmt(lbHi)} g) and ${L.proteinPctMin}–${L.proteinPctMax}% of calories (${fmt(pctLo)}–${fmt(pctHi)} g) at this calorie level. Consider goal weight as the reference weight, or record why.` });
  }

  // --- Carbohydrate ---------------------------------------------------------
  const cPct = pctOfCalories(input.carbG, 4, cal);
  const cMin = input.goal === "weight_loss" ? L.carbPctMinWeightLoss : L.carbPctMin;
  const okC = cPct >= cMin && cPct <= L.carbPctMax;
  add({ rule_key: "carb_pct", label: "Carbohydrate % of calories", status: okC ? "ok" : "warn", value: `${fmt(cPct)}%`, message: okC ? `Within ${cMin}–${L.carbPctMax}% of calories${input.goal === "weight_loss" ? " (25–40% acceptable for weight loss)" : ""}.` : `Carbohydrate is ${fmt(cPct)}% of calories, outside ${cMin}–${L.carbPctMax}%.` });

  // --- Fat ------------------------------------------------------------------
  const fPct = pctOfCalories(input.fatG, 9, cal);
  const fStatus: GuardrailStatus = fPct < L.fatPctBlocked ? "blocked" : fPct < L.fatPctMin - 1e-9 || fPct > L.fatPctMax ? "warn" : "ok";
  add({
    rule_key: "fat_pct",
    label: "Fat % of calories",
    status: fStatus,
    value: `${fmt(fPct)}%`,
    message:
      fStatus === "blocked"
        ? `Fat is ${fmt(fPct)}% of calories — below ${L.fatPctBlocked}% is not allowed.`
        : fStatus === "warn"
          ? `Fat is ${fmt(fPct)}% of calories, outside ${L.fatPctMin}–${L.fatPctMax}%.`
          : `Within ${L.fatPctMin}–${L.fatPctMax}% of calories.`,
  });

  // --- Reconciliation -------------------------------------------------------
  const macroKcal = kcalFromMacros(input.proteinG, input.carbG, input.fatG);
  const diff = macroKcal - cal;
  add(
    Math.abs(diff) > 2
      ? { rule_key: "macro_reconcile", label: "Macros reconcile", status: "blocked", value: `${fmt(macroKcal)} kcal`, message: `4P + 4C + 9F = ${fmt(macroKcal)} kcal, which differs from the ${fmt(cal)} kcal target by ${fmt(diff)} kcal. Recompute macros.` }
      : { rule_key: "macro_reconcile", label: "Macros reconcile", status: "ok", value: `${fmt(macroKcal)} kcal`, message: "4P + 4C + 9F matches the calorie target." },
  );

  // --- Water (guidance only) ------------------------------------------------
  add({ rule_key: "water", label: "Hydration guidance", status: "ok", message: `Guidance: ${L.waterFlOzMin}–${L.waterFlOzMax} fl oz total fluids/day (about 20% from food).` });

  // --- Cardio ---------------------------------------------------------------
  if (input.cardio) {
    const rule = GOAL_TEMPLATES[input.goal].cardio;
    if (input.cardio.removed) {
      add({ rule_key: "cardio_removed", label: "Cardio removed", status: "warn", message: `The ${GOAL_TEMPLATES[input.goal].label.toLowerCase()} template calls for cardio (${rule.freqMin}–${rule.freqMax} sessions/week). Record why it was removed.` });
    } else {
      const { sessionsPerWeek: f, minutesPerSession: m } = input.cardio;
      const okF = f >= rule.freqMin && f <= rule.freqMax;
      const okM = m >= rule.minMin && m <= rule.minMax;
      add({ rule_key: "cardio_prescription", label: "Cardio frequency/duration", status: okF && okM ? "ok" : "warn", value: `${f}×${m} min`, message: okF && okM ? `Within ${rule.freqMin}–${rule.freqMax} sessions × ${rule.minMin}–${rule.minMax} min.` : `${f} sessions × ${m} min is outside the goal range of ${rule.freqMin}–${rule.freqMax} sessions × ${rule.minMin}–${rule.minMax} min.` });
    }
  }

  return out;
}

export function worstStatus(results: GuardrailResult[]): GuardrailStatus {
  if (results.some((r) => r.status === "blocked")) return "blocked";
  if (results.some((r) => r.status === "warn")) return "warn";
  return "ok";
}

export interface OverrideRecord {
  rule_key: string;
  reason: string;
}

/**
 * Approval gate for guardrails: nothing blocked, and every warn has an
 * override with a non-empty reason.
 */
export function guardrailApprovalIssues(results: GuardrailResult[], overrides: OverrideRecord[]): string[] {
  const issues: string[] = [];
  for (const r of results) {
    if (r.status === "blocked") issues.push(`Blocked: ${r.label} — ${r.message}`);
    if (r.status === "warn" && !overrides.some((o) => o.rule_key === r.rule_key && o.reason.trim().length > 0)) {
      issues.push(`Needs override reason: ${r.label}`);
    }
  }
  return issues;
}
