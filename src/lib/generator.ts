/**
 * Plan generator. Order: intake → split and strength sessions → cardio →
 * mobility → energy model → calorie and macro targets → example days →
 * guardrail pass. The selector (LLM) only picks exercises and writes notes.
 */
import { CALIBRATION, DEFAULT_DEFICIT, METS, NEAT_FACTORS } from "@/config/energy";
import { GOAL_TEMPLATES, type GoalCategory } from "@/config/goal-templates";
import { GUARDRAIL_DEFAULTS, type GuardrailLimits } from "@/config/guardrails";
import { DEFAULT_PLAN_WEEKS, PHASES } from "@/config/training-variables";
import { buildEnergyModel, describePrediction, inToCm, lbToKg, type EnergyOutputs, type ExerciseLoad } from "./energy";
import { allowedFoods, buildExampleDays, foodLists, groceryStaples, swapTable } from "./example-days";
import { evaluateGuardrails, type GuardrailResult } from "./guardrails";
import { blockedSections, IntakeAnswersSchema, isDeconditioned, REFER_OUT_FLAGS, type IntakeAnswers, type ReferOutFlags, type ReferralHandling } from "./intake";
import { computeMacroTargets, withEditedMacros, type MacroTargets } from "./nutrition";
import type { GeneratedPlan, LibExercise, LibFood, NutritionPlan, PlanParameters, TrainingPlan } from "./plan-types";
import { assembleTraining, buildSkeleton, defaultPhaseSequence, defaultSelection, exerciseLoadsForWeek, recomputeWeekMinutes, SPLIT_LABELS, type CandidateFilter } from "./training";
import { chooseProgram, phaseHint, suggestFocus, type ProgramChoice } from "./program-design";
import { FOCUS_LABELS, type Focus } from "@/config/program-styles";
import { detectSkill, SKILLS, type SkillKey } from "@/config/skills";
import type { Selector } from "./selection";

export interface ClearanceContext {
  status: "pending" | "received" | "not_required";
  notes: string | null;
  exercise_limits: string | null;
  hr_ceiling: number | null;
  rpe_ceiling: number | null;
  activities_to_avoid: string | null;
}

export interface GeneratorContext {
  goal: GoalCategory;
  intake: IntakeAnswers;
  referOut: Partial<ReferOutFlags> | null;
  /** PAR-Q answered yes to anything: physician clearance needed before hard training */
  parqFlagged?: boolean;
  referralsHandled: ReferralHandling[];
  clearance: ClearanceContext | null;
  exercises: LibExercise[];
  foods: LibFood[];
  limits?: Partial<GuardrailLimits>;
  defaultDeficits?: Partial<Record<GoalCategory, number>>;
  /** default TDEE uncertainty by mode (Settings); plan parameter overrides */
  uncertainty?: { formula: number; measured: number } | null;
}

/** The client's own words the program designer reads for focus and style. */
export function intakeText(a: IntakeAnswers): string {
  return [a.primary_goal, a.success_90_days, a.sport_activity, a.exercise_likes, a.timeline_event].filter(Boolean).join(" \n ");
}

/** The client's goal statements only (not likes), used to spot a skill goal. */
export function goalText(a: IntakeAnswers): string {
  return [a.primary_goal, a.success_90_days, a.timeline_event].filter(Boolean).join(" \n ");
}

/** Skill goal for these parameters: the trainer's choice, else detected from the client's goals. */
export function skillFor(a: IntakeAnswers, p: Pick<PlanParameters, "skill">): { skill: SkillKey | null; reason: string } {
  const skill = p.skill === "none" ? null : p.skill ?? detectSkill(goalText(a));
  if (!skill) return { skill: null, reason: "" };
  const def = SKILLS[skill];
  return {
    skill,
    reason: `Skill goal: ${def.label} (${p.skill ? "chosen by you" : "from the client's goals"}). Every session starts with the ${def.label.toLowerCase()} progression while fresh, plus its supporting work; the step moves up each 4-week block. ${def.progressCue}`,
  };
}

/** Program style and focus for these parameters (trainer's choice, else automatic). */
export function programFor(goal: GoalCategory, a: IntakeAnswers, p: Pick<PlanParameters, "days_per_week" | "session_length_min" | "split" | "focus">): ProgramChoice & { focus: Focus[]; focusReason: string } {
  const choice = chooseProgram({ goal, daysPerWeek: p.days_per_week, level: a.training_history, deconditioned: isDeconditioned(a), age: a.age, sessionLengthMin: p.session_length_min, equipment: a.equipment, text: intakeText(a), override: p.split ?? null });
  const focus = p.focus ?? suggestFocus(intakeText(a));
  const focusReason = p.focus ? (p.focus.length ? `Focus chosen by you: ${p.focus.map((f) => FOCUS_LABELS[f]).join(", ")}.` : "") : focus.length ? `Focus from the client's goals: ${focus.map((f) => FOCUS_LABELS[f]).join(", ")}.` : "";
  return { ...choice, focus, focusReason };
}

export function defaultParameters(ctx: Pick<GeneratorContext, "goal" | "intake" | "defaultDeficits">, overrides: Partial<PlanParameters> = {}, today: string): PlanParameters {
  const a = ctx.intake;
  const weeks = overrides.weeks ?? DEFAULT_PLAN_WEEKS;
  const measured = a.measured_tdee != null;
  const days = overrides.days_per_week ?? a.training_days_per_week;
  const length = overrides.session_length_min ?? a.session_length_min;
  const program = programFor(ctx.goal, a, { days_per_week: days, session_length_min: length, split: overrides.split ?? null, focus: overrides.focus ?? null });
  return {
    start_date: overrides.start_date ?? today,
    weeks,
    days_per_week: days,
    session_length_min: length,
    phase_sequence: overrides.phase_sequence ?? defaultPhaseSequence(ctx.goal, a.training_history, isDeconditioned(a), weeks, phaseHint(program.split, a.training_history)),
    calorie_mode: overrides.calorie_mode ?? "deficit",
    deficit: overrides.deficit ?? ctx.defaultDeficits?.[ctx.goal] ?? DEFAULT_DEFICIT[ctx.goal],
    target_override: overrides.target_override ?? null,
    bmr_method: overrides.bmr_method ?? "mifflin",
    neat_level: overrides.neat_level ?? a.activity_level,
    energy_mode: overrides.energy_mode ?? (measured ? "measured" : "formula"),
    reference_weight: overrides.reference_weight ?? "current",
    protein_g_per_lb: overrides.protein_g_per_lb ?? null,
    fat_pct: overrides.fat_pct ?? null,
    checkpoint_weeks: overrides.checkpoint_weeks ?? [...CALIBRATION.defaultCheckpointWeeks[ctx.goal]].filter((w) => w <= weeks),
    uncertainty_pct: overrides.uncertainty_pct ?? null,
    energy_week: overrides.energy_week ?? 1,
    weight_lb: overrides.weight_lb ?? a.weight_lb,
    split: overrides.split ?? null,
    focus: overrides.focus ?? null,
    rotate_accessories: overrides.rotate_accessories ?? true,
    skill: overrides.skill ?? null,
  };
}

export function clearanceNotesText(c: ClearanceContext | null): string | null {
  if (!c || c.status === "not_required") return null;
  const parts: string[] = [];
  if (c.status === "pending") parts.push("PHYSICIAN CLEARANCE PENDING — plan cannot be approved yet.");
  if (c.exercise_limits) parts.push(`Exercise limits: ${c.exercise_limits}`);
  if (c.hr_ceiling) parts.push(`Heart-rate ceiling: ${c.hr_ceiling} bpm`);
  if (c.rpe_ceiling) parts.push(`RPE ceiling: ${c.rpe_ceiling}`);
  if (c.activities_to_avoid) parts.push(`Avoid: ${c.activities_to_avoid}`);
  if (c.notes) parts.push(`Notes: ${c.notes}`);
  return parts.length ? parts.join("\n") : null;
}

/** Enforce a clearance RPE ceiling on every prescription (deterministic). */
export function applyRpeCeiling(t: TrainingPlan, ceiling: number | null | undefined): TrainingPlan {
  if (!ceiling) return t;
  return {
    ...t,
    weeks: t.weeks.map((w) => ({
      ...w,
      prescriptions: Object.fromEntries(
        Object.entries(w.prescriptions).map(([k, p]) => [k, { ...p, rpe_min: Math.min(p.rpe_min, ceiling), rpe_max: Math.min(p.rpe_max, ceiling) }]),
      ),
    })),
  };
}

/** PAR-Q flagged and no physician clearance received yet (pending or not recorded). */
export function clearanceAwaited(ctx: Pick<GeneratorContext, "parqFlagged" | "clearance">): boolean {
  return Boolean(ctx.parqFlagged) && (!ctx.clearance || ctx.clearance.status === "pending");
}

export const CLEARANCE_HOLD_REASON = "Physician clearance not received yet: cardio is held and all training is capped at RPE 6 (easy, conversational effort). Record the clearance and regenerate to lift this.";
const CLEARANCE_RPE = 6;

/** Before clearance: no cardio prescription, strength capped at an easy effort. */
export function holdForClearance(t: TrainingPlan): TrainingPlan {
  const capped = applyRpeCeiling(t, CLEARANCE_RPE);
  return {
    ...capped,
    cardio: { ...capped.cardio, removed: true, removed_reason: "Held until physician clearance is received.", weeks: capped.cardio.weeks.map((w) => ({ ...w, sessions: 0, minutes: 0 })) },
  };
}

export function candidateFilter(a: IntakeAnswers): CandidateFilter {
  return { equipment: a.equipment, injuryAreas: a.injury_areas, dislikes: a.exercise_dislikes };
}

const BASELINE_MET: Record<string, keyof typeof METS> = {
  strength: "resistance_moderate",
  walking: "walking",
  jogging: "jogging",
  running: "running",
  cycling: "cycling_moderate",
  mobility: "mobility",
  yoga: "yoga",
  sport: "jogging",
};

export function baselineLoads(a: IntakeAnswers): ExerciseLoad[] | null {
  if (a.current_exercise.length === 0 && !a.current_exercise_confirmed) return null;
  return a.current_exercise.map((e) => ({
    category: e.type === "strength" ? "strength" : e.type === "mobility" || e.type === "yoga" ? "mobility" : "cardio",
    label: `Current ${e.type}`,
    met: METS[BASELINE_MET[e.type]].met,
    minutes: e.minutes,
    perWeek: e.sessions_per_week,
  }));
}

export function referenceWeight(a: IntakeAnswers, p: PlanParameters): number {
  return p.reference_weight === "goal" && a.goal_weight_lb ? a.goal_weight_lb : p.weight_lb;
}

export interface Derived {
  energy: EnergyOutputs | null;
  nutrition: NutritionPlan;
  guardrail_flags: GuardrailResult[];
}

/**
 * Everything downstream of the training plan: energy model, targets,
 * example days and guardrails. Re-run whenever training, cardio or
 * parameters change.
 */
export function deriveNutrition(ctx: GeneratorContext, params: PlanParameters, training: TrainingPlan | null, opts: { macroEdits?: Partial<Pick<MacroTargets, "protein_g" | "fat_g">> | null; exampleDayCount?: number } = {}): Derived {
  const a = ctx.intake;
  const limits: GuardrailLimits = { ...GUARDRAIL_DEFAULTS, ...(ctx.limits ?? {}) };
  const blocked = blockedSections(ctx.referOut, ctx.referralsHandled);
  const nutritionBlocked = blocked.nutrition.length > 0;

  const emptyNutrition = (reason: string): NutritionPlan => ({
    blocked: true,
    blocked_reason: reason,
    targets: null,
    meals_per_day: a.meals_per_day,
    meals_guidance: "",
    food_lists: {},
    example_days: [],
    swaps: [],
    grocery_staples: [],
    fiber_text: "",
    hydration_text: "",
    energy: null,
    prediction_text: "",
    notes: [],
  });

  const trainingFlags: GuardrailResult[] = [];
  if (training) {
    const cw = training.cardio.weeks[0];
    const rule = GOAL_TEMPLATES[ctx.goal].cardio;
    if (training.cardio.removed) {
      trainingFlags.push({ rule_key: "cardio_removed", label: "Cardio removed", status: "warn", message: training.cardio.removed_reason ? `${training.cardio.removed_reason} The ${GOAL_TEMPLATES[ctx.goal].label.toLowerCase()} template calls for ${rule.freqMin}–${rule.freqMax} sessions/week once it's safe.` : `The ${GOAL_TEMPLATES[ctx.goal].label.toLowerCase()} template calls for cardio (${rule.freqMin}–${rule.freqMax} sessions/week). Record why it was removed.` });
    } else if (cw) {
      const okF = cw.sessions >= rule.freqMin && cw.sessions <= rule.freqMax;
      const okM = cw.minutes >= rule.minMin && cw.minutes <= rule.minMax;
      trainingFlags.push({ rule_key: "cardio_prescription", label: "Cardio frequency/duration", status: okF && okM ? "ok" : "warn", value: `${cw.sessions}×${cw.minutes} min`, message: okF && okM ? `Within ${rule.freqMin}–${rule.freqMax} sessions × ${rule.minMin}–${rule.minMax} min.` : `${cw.sessions} sessions × ${cw.minutes} min is outside ${rule.freqMin}–${rule.freqMax} sessions × ${rule.minMin}–${rule.minMax} min.` });
    }
  }

  if (nutritionBlocked) {
    const reason = `Nutrition not generated — refer out: ${blocked.nutrition.map((f) => REFER_OUT_FLAGS[f].label).join(", ")}. Record how it was handled to unlock.`;
    return { energy: null, nutrition: emptyNutrition(reason), guardrail_flags: trainingFlags };
  }

  // --- Energy model -------------------------------------------------------
  const loads = training ? exerciseLoadsForWeek(training, params.energy_week) : baselineLoads(a) ?? [];
  const measured = params.energy_mode === "measured" && a.measured_tdee != null;
  const energy = buildEnergyModel({
    mode: measured ? "measured" : "formula",
    sex: a.sex,
    age: a.age,
    heightCm: inToCm(a.height_in),
    weightKg: lbToKg(params.weight_lb),
    bodyFatPct: a.body_fat_pct,
    bmrMethod: params.bmr_method === "katch" && a.body_fat_pct != null ? "katch" : "mifflin",
    neatFactor: NEAT_FACTORS[params.neat_level].factor,
    loads,
    deficit: params.deficit,
    targetOverride: params.calorie_mode === "fixed" ? params.target_override : null,
    measured: measured
      ? { tdee: a.measured_tdee!, days: a.measured_tdee_days ?? 0, baselineLoads: baselineLoads(a), baselineActiveKcalPerDay: a.wearable_active_kcal_per_day }
      : null,
    uncertaintyPct: params.uncertainty_pct ?? (ctx.uncertainty ? ctx.uncertainty[measured ? "measured" : "formula"] : null),
  });
  if (!training) energy.notes.push("Training is on hold, so the model uses the client's current exercise.");

  // --- Targets -------------------------------------------------------------
  const refW = referenceWeight(a, params);
  let targets = computeMacroTargets({ goal: ctx.goal, calories: energy.target_kcal, referenceWeightLb: refW, sex: a.sex, proteinGPerLb: params.protein_g_per_lb, fatPct: params.fat_pct, limits });
  if (opts.macroEdits && (opts.macroEdits.protein_g != null || opts.macroEdits.fat_g != null)) {
    // Trainer-edited grams; carbs stay the remainder and guardrails re-check everything.
    targets = withEditedMacros(targets, { protein_g: opts.macroEdits.protein_g ?? undefined, fat_g: opts.macroEdits.fat_g ?? undefined });
  }

  // --- Food guidance -------------------------------------------------------
  const prefs = { dietaryPattern: a.dietary_pattern, allergies: a.allergies, excluded: a.foods_excluded };
  const allowed = allowedFoods(ctx.foods, prefs);
  const exampleDays = buildExampleDays({ foods: ctx.foods, targets, mealsPerDay: a.meals_per_day, count: opts.exampleDayCount ?? 4, prefs });
  const perMeal = Math.round(targets.protein_g / a.meals_per_day);
  const nutrition: NutritionPlan = {
    blocked: false,
    blocked_reason: null,
    targets,
    meals_per_day: a.meals_per_day,
    meals_guidance: `${a.meals_per_day} meals per day works well for this client. Spreading protein evenly means roughly ${perMeal} g per meal. Timing is flexible — hit the daily targets within their bands.`,
    food_lists: foodLists(allowed),
    example_days: exampleDays,
    swaps: swapTable(allowed),
    grocery_staples: groceryStaples(exampleDays),
    fiber_text: `Fiber: about ${targets.fiber_g} g per day (14 g per 1,000 kcal) from vegetables, fruit, legumes and whole grains.`,
    hydration_text: targets.water.text,
    energy,
    prediction_text: describePrediction(energy),
    notes: [
      "Targets are estimates, not prescriptions. Hit each daily number within its tolerance band; exact meals are flexible.",
      ...(targets.protein_conflict ? [targets.protein_conflict] : []),
      ...(exampleDays.length < 3 ? ["Fewer than three example days could be built inside every tolerance band from the allowed foods; add foods to the library or adjust exclusions."] : []),
    ],
  };

  // --- Guardrails ---------------------------------------------------------
  const flags = evaluateGuardrails({
    goal: ctx.goal,
    targetKcal: targets.calories,
    tdee: energy.tdee,
    proteinG: targets.protein_g,
    carbG: targets.carbs_g,
    fatG: targets.fat_g,
    referenceWeightLb: refW,
    predictedLbPerWeek: energy.predicted_lb_per_week,
    predictedLow: energy.predicted_low,
    predictedHigh: energy.predicted_high,
    energyMode: energy.mode,
    baselineMissing: energy.baseline_missing,
    measuredWindowShort: energy.measured_window_short,
    cardio: null,
    limits,
  });
  return { energy, nutrition, guardrail_flags: [...flags, ...trainingFlags] };
}

export async function generatePlan(ctx: GeneratorContext, overrides: Partial<PlanParameters>, today: string, selector: Selector): Promise<GeneratedPlan> {
  const a = ctx.intake;
  const params = defaultParameters(ctx, overrides, today);
  const blocked = blockedSections(ctx.referOut, ctx.referralsHandled);
  const tpl = GOAL_TEMPLATES[ctx.goal];

  let training: TrainingPlan | null = null;
  let trainingBlockedReason: string | null = null;
  if (blocked.training.length > 0) {
    trainingBlockedReason = `Training not generated — refer out: ${blocked.training.map((f) => REFER_OUT_FLAGS[f].label).join(", ")}. Record clearance or referral to unlock.`;
  } else {
    const filter = candidateFilter(a);
    const program = programFor(ctx.goal, a, params);
    const skill = skillFor(a, params);
    const awaitingClearance = clearanceAwaited(ctx);
    const sk = buildSkeleton(
      {
        goal: ctx.goal,
        split: program.split,
        skill: skill.skill,
        splitReasons: [
          ...(skill.reason ? [skill.reason] : []),
          ...program.reasons,
          ...(program.focusReason ? [program.focusReason] : []),
          ...(program.overrideIgnored ? [program.overrideIgnored] : []),
          ...(awaitingClearance ? [CLEARANCE_HOLD_REASON] : []),
        ],
        focus: program.focus,
        daysPerWeek: params.days_per_week,
        sessionLengthMin: params.session_length_min,
        preferredDays: a.preferred_days,
        weeks: params.weeks,
        phaseSequence: params.phase_sequence,
        level: a.training_history,
        deconditioned: isDeconditioned(a),
        age: a.age,
        filter,
        hrCeiling: ctx.clearance?.hr_ceiling ?? null,
      },
      ctx.exercises,
    );
    const sel = await selector(sk, {
      goal_label: tpl.label,
      primary_goal: a.primary_goal,
      success_90_days: a.success_90_days,
      sport_activity: a.sport_activity,
      training_history: a.training_history,
      equipment: a.equipment,
      exercise_likes: a.exercise_likes,
      cardio_preferences: a.cardio_preferences,
      split_label: SPLIT_LABELS[sk.split],
      split_reasons: sk.split_reasons,
      focus: sk.focus.map((f) => FOCUS_LABELS[f]),
      ...(sk.skill ? { skill_goal: SKILLS[sk.skill].label } : {}),
      phases: params.phase_sequence.map((p) => PHASES[p].label),
    });
    training = assembleTraining(sk, sel.choices, ctx.exercises, {
      weeks: params.weeks,
      phaseSequence: params.phase_sequence,
      sessionLengthMin: params.session_length_min,
      filter,
      shortRest: tpl.shortRestOk,
      guidelines: [...tpl.guidelines],
      clearanceNotes: clearanceNotesText(ctx.clearance),
      coachingNotes: sel.coaching_notes,
      summary: sel.program_summary,
      source: sel.source,
      rotateAccessories: params.rotate_accessories ?? true,
    });
    training = applyRpeCeiling(training, ctx.clearance?.rpe_ceiling);
    if (awaitingClearance) training = holdForClearance(training);
  }

  const d = deriveNutrition(ctx, params, training);
  return {
    goal_category: ctx.goal,
    parameters: params,
    training,
    training_blocked_reason: trainingBlockedReason,
    nutrition: d.nutrition,
    energy: d.energy,
    guardrail_flags: d.guardrail_flags,
  };
}

/** Library-default selector (no LLM): used by tests and seed scripts only. */
export const libraryDefaultSelector: Selector = async (sk) => {
  const sel = defaultSelection(sk);
  return {
    choices: Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, { exercise_id: v, note: "" }])),
    coaching_notes: [],
    program_summary: "",
    source: "library_default",
  };
};

export interface ChangeRow {
  label: string;
  before: string;
  after: string;
}

/** Human-readable diff of key numbers after an edit. */
export function diffDerived(before: { energy: EnergyOutputs | null; nutrition: NutritionPlan }, after: { energy: EnergyOutputs | null; nutrition: NutritionPlan }): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const r = (n: number | undefined | null, d = 0) => (n == null ? "—" : n.toFixed(d));
  const cmp = (label: string, b: number | undefined | null, a: number | undefined | null, d = 0) => {
    if (r(b, d) !== r(a, d)) rows.push({ label, before: r(b, d), after: r(a, d) });
  };
  cmp("Planned exercise (kcal/day)", before.energy?.planned_exercise_kcal_per_day, after.energy?.planned_exercise_kcal_per_day);
  cmp("TDEE (kcal/day)", before.energy?.tdee, after.energy?.tdee);
  cmp("Calorie target", before.nutrition.targets?.calories, after.nutrition.targets?.calories);
  cmp("Protein (g)", before.nutrition.targets?.protein_g, after.nutrition.targets?.protein_g);
  cmp("Carbs (g)", before.nutrition.targets?.carbs_g, after.nutrition.targets?.carbs_g);
  cmp("Fat (g)", before.nutrition.targets?.fat_g, after.nutrition.targets?.fat_g);
  cmp("Predicted lb/week", before.energy?.predicted_lb_per_week, after.energy?.predicted_lb_per_week, 2);
  return rows;
}

export { recomputeWeekMinutes };

/** What the generate form shows for program style and focus. */
export function programDefaults(goal: GoalCategory, answers: unknown, p?: Partial<PlanParameters>): { split: PlanParameters["split"]; auto: { split: ProgramChoice["split"]; reason: string }; focus: Focus[]; rotate: boolean; session_length_min: number; skill: PlanParameters["skill"]; autoSkill: SkillKey | null } | undefined {
  const parsed = IntakeAnswersSchema.safeParse(answers);
  if (!parsed.success) return undefined;
  const a = parsed.data;
  const days = p?.days_per_week ?? a.training_days_per_week;
  const length = p?.session_length_min ?? a.session_length_min;
  const auto = programFor(goal, a, { days_per_week: days, session_length_min: length, split: null, focus: p?.focus ?? null });
  return { split: p?.split ?? null, auto: { split: auto.split, reason: auto.reasons[0] ?? "" }, focus: auto.focus, rotate: p?.rotate_accessories ?? true, session_length_min: length, skill: p?.skill ?? null, autoSkill: detectSkill(goalText(a)) };
}
