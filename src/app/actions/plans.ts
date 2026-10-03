"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { generatorContext, getPlan, latestIntake } from "@/lib/data/clients";
import { deriveNutrition, diffDerived, generatePlan, type ChangeRow } from "@/lib/generator";
import { claudeSelector } from "@/lib/llm";
import { SelectionError } from "@/lib/selection";
import { approvalIssues } from "@/lib/data/approval";
import { todayIn, weekStart } from "@/lib/dates";
import { checkpointDate, planEndDate, retestDate } from "@/lib/tasks";
import { isUsable, recomputeWeekMinutes, resolveVariation, unitFor } from "@/lib/training";
import { FOCUS_AREAS, SPLITS, type Focus, type Split } from "@/config/program-styles";
import { candidateFilter } from "@/lib/generator";
import { PRESET_BENCHMARKS } from "@/config/goal-templates";
import { METS, NEAT_FACTORS, type Activity, type NeatLevel } from "@/config/energy";
import type { PlanParameters, Prescription, TrainingPlan } from "@/lib/plan-types";
import type { PlanRow } from "@/lib/data/types";
import type { Phase } from "@/config/training-variables";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActionState {
  error: string | null;
  details?: string[];
  changes?: ChangeRow[];
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === "" ? null : Number(v);
};

async function nextVersion(db: SupabaseClient, clientId: string) {
  const { data } = await db.from("plans").select("version").eq("client_id", clientId).order("version", { ascending: false }).limit(1);
  return (data?.[0]?.version ?? 0) + 1;
}

async function insertEnergyModel(db: SupabaseClient, planId: string, plan: Pick<PlanRow, "parameters" | "nutrition">) {
  const e = plan.nutrition?.energy;
  if (!e) return;
  await db.from("energy_models").insert({ plan_id: planId, mode: e.mode, inputs: plan.parameters, outputs: e, uncertainty_pct: e.uncertainty_pct });
}

function parseOverrides(form: FormData): Partial<PlanParameters> {
  const o: Partial<PlanParameters> = {};
  const sd = str(form, "start_date");
  if (sd) o.start_date = sd;
  const weeks = num(form, "weeks");
  if (weeks) o.weeks = Math.max(4, Math.min(24, Math.round(weeks)));
  const days = num(form, "days_per_week");
  if (days) o.days_per_week = Math.max(2, Math.min(6, Math.round(days)));
  const len = num(form, "session_length_min");
  if (len) o.session_length_min = len;
  const deficit = num(form, "deficit");
  if (deficit != null) o.deficit = deficit;
  const seq = str(form, "phase_sequence");
  if (seq) o.phase_sequence = seq.split(",").map((s) => s.trim()).filter(Boolean) as Phase[];
  // Program options (only when the form shows them).
  if (form.has("split")) {
    const sp = str(form, "split");
    o.split = (SPLITS as string[]).includes(sp) ? (sp as Split) : null;
  }
  if (form.has("focus_set")) o.focus = form.getAll("focus").map(String).filter((f): f is Focus => (FOCUS_AREAS as string[]).includes(f));
  if (form.has("rotate_set")) o.rotate_accessories = form.get("rotate_accessories") === "on";
  return o;
}

/** Generate (or regenerate) a draft. Older drafts are archived; the approved plan stays until a new one is approved. */
export async function generatePlanAction(clientId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const db = createClient();
  const settings = await getSettings(db);
  let ctx;
  try {
    ctx = await generatorContext(db, clientId, settings);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const fromPlan = str(form, "from_plan_id");
  let overrides = parseOverrides(form);
  if (fromPlan) {
    const prev = await getPlan(db, fromPlan);
    if (prev) overrides = { ...prev.parameters, ...overrides, energy_week: 1, weight_lb: ctx.intake.weight_lb, uncertainty_pct: null, calorie_mode: "deficit", target_override: null };
  }
  let plan;
  try {
    plan = await generatePlan(ctx, overrides, todayIn(), claudeSelector);
  } catch (e) {
    if (e instanceof SelectionError) return { error: e.message, details: e.details };
    throw e;
  }
  const version = await nextVersion(db, clientId);
  await db.from("plans").update({ status: "archived" }).eq("client_id", clientId).eq("status", "draft");
  const { data, error } = await db
    .from("plans")
    .insert({
      client_id: clientId,
      version,
      goal_category: plan.goal_category,
      status: "draft",
      parameters: plan.parameters,
      training: plan.training,
      nutrition: { ...plan.nutrition, training_blocked_reason: plan.training_blocked_reason },
      guardrail_flags: plan.guardrail_flags,
    })
    .select("id, parameters, nutrition")
    .single();
  if (error) return { error: error.message };
  await insertEnergyModel(db, data.id, data as PlanRow);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/plan/${data.id}`);
}

async function loadDraft(db: SupabaseClient, planId: string): Promise<PlanRow> {
  const plan = await getPlan(db, planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "draft") throw new Error("Only drafts can be edited. Create a revision first.");
  return plan;
}

/** Recompute everything downstream of training/parameters, save, and return what changed. */
async function recomputeAndSave(db: SupabaseClient, plan: PlanRow, params: PlanParameters, training: TrainingPlan | null): Promise<ActionState> {
  const settings = await getSettings(db);
  const ctx = await generatorContext(db, plan.client_id, settings, plan.goal_category);
  const derived = deriveNutrition(ctx, params, training);
  const changes = diffDerived({ energy: plan.nutrition?.energy ?? null, nutrition: plan.nutrition }, derived);
  const nutrition = { ...derived.nutrition, training_blocked_reason: (plan.nutrition as { training_blocked_reason?: string | null })?.training_blocked_reason ?? null };
  const { error } = await db.from("plans").update({ parameters: params, training, nutrition, guardrail_flags: derived.guardrail_flags }).eq("id", plan.id);
  if (error) return { error: error.message };
  await insertEnergyModel(db, plan.id, { parameters: params, nutrition });
  revalidatePath(`/clients/${plan.client_id}/plan/${plan.id}`);
  return { error: null, ok: true, changes };
}

function validRx(p: Prescription): string | null {
  if (!(p.sets >= 1 && p.sets <= 10)) return "Sets must be 1–10.";
  if (!(p.reps_min >= 1 && p.reps_max <= 60 && p.reps_min <= p.reps_max)) return "Reps must be 1–60 with min ≤ max.";
  if (!(p.rest_sec >= 0 && p.rest_sec <= 600)) return "Rest must be 0–600 s.";
  if (!(p.rpe_min >= 1 && p.rpe_max <= 10 && p.rpe_min <= p.rpe_max)) return "RPE must be 1–10 with min ≤ max.";
  return null;
}

export async function editPlanAction(planId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const db = createClient();
  let plan: PlanRow;
  try {
    plan = await loadDraft(db, planId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const op = str(form, "op");
  let params: PlanParameters = { ...plan.parameters };
  let training: TrainingPlan | null = plan.training ? structuredClone(plan.training) : null;

  if (op === "swap" || op === "rx" || op === "cardio" || op === "mobility") {
    if (!training) return { error: "Training is not generated for this plan." };
  }

  if (op === "swap") {
    const slotId = str(form, "slot_id");
    const exId = str(form, "exercise_id");
    const settings = await getSettings(db);
    const ctx = await generatorContext(db, plan.client_id, settings, plan.goal_category);
    const ex = ctx.exercises.find((e) => e.id === exId);
    const filter = candidateFilter(ctx.intake);
    const session = training!.sessions.find((s) => s.slots.some((x) => x.id === slotId));
    const slot = session?.slots.find((x) => x.id === slotId);
    if (!ex || !slot || !session) return { error: "Unknown exercise or slot." };
    if (ex.pattern !== slot.pattern) return { error: "Pick an exercise with the same movement pattern." };
    if (!isUsable(ex, filter)) return { error: "That exercise needs unavailable equipment, is contraindicated, or is on the client's dislike list." };
    const main = slot.role === "main" || slot.role === "secondary";
    Object.assign(slot, {
      exercise: { id: ex.id, name: ex.name },
      regression: resolveVariation(ex, "regression", ctx.exercises, filter, main),
      progression: resolveVariation(ex, "progression", ctx.exercises, filter, main),
      unit: unitFor(ex.name),
      note: "",
    });
    training!.weeks = training!.weeks.map((w) => recomputeWeekMinutes(training!.sessions, w));
  } else if (op === "rx") {
    const slotId = str(form, "slot_id");
    const scope = str(form, "scope"); // "week" | "phase" | "all"
    const week = Number(str(form, "week"));
    const rx: Prescription = { sets: Number(str(form, "sets")), reps_min: Number(str(form, "reps_min")), reps_max: Number(str(form, "reps_max")), rest_sec: Number(str(form, "rest_sec")), rpe_min: Number(str(form, "rpe_min")), rpe_max: Number(str(form, "rpe_max")) };
    const bad = validRx(rx);
    if (bad) return { error: bad };
    const target = training!.weeks.find((w) => w.week === week);
    if (!target) return { error: "Unknown week." };
    training!.weeks = training!.weeks.map((w) => {
      const applies = scope === "all" ? !w.deload : scope === "phase" ? w.phase === target.phase && w.deload === target.deload : w.week === week;
      if (!applies || (!w.prescriptions[slotId] && str(form, "include") !== "on")) return w;
      return recomputeWeekMinutes(training!.sessions, { ...w, prescriptions: { ...w.prescriptions, [slotId]: rx } });
    });
  } else if (op === "remove_slot") {
    const slotId = str(form, "slot_id");
    const week = Number(str(form, "week"));
    const target = training!.weeks.find((w) => w.week === week);
    training!.weeks = training!.weeks.map((w) => {
      if (!target || w.phase !== target.phase) return w;
      const { [slotId]: _drop, ...rest } = w.prescriptions;
      void _drop;
      return recomputeWeekMinutes(training!.sessions, { ...w, prescriptions: rest });
    });
  } else if (op === "cardio") {
    const removed = form.get("removed") === "on";
    const fromWeek = Number(str(form, "from_week") || 1);
    const sessions = Number(str(form, "sessions"));
    const minutes = Number(str(form, "minutes"));
    const activity = str(form, "activity") as Activity;
    if (!removed && (!(sessions >= 0 && sessions <= 14) || !(minutes >= 0 && minutes <= 240))) return { error: "Cardio sessions must be 0–14 and minutes 0–240." };
    if (activity && !(activity in METS)) return { error: "Unknown activity." };
    const c = training!.cardio;
    c.removed = removed;
    c.removed_reason = removed ? str(form, "removed_reason") || c.removed_reason : undefined;
    if (activity) {
      c.activity = activity;
      c.met = METS[activity].met;
    }
    c.weeks = c.weeks.map((w) => (removed ? { ...w, sessions: 0, minutes: 0 } : w.week >= fromWeek ? { ...w, sessions, minutes } : w));
    if (removed && c.removed_reason) {
      await db.from("guardrail_overrides").insert({ plan_id: plan.id, rule_key: "cardio_removed", original_value: "cardio prescribed", override_value: "removed", reason: c.removed_reason });
    }
  } else if (op === "mobility") {
    training!.mobility.sessions_per_week = Math.max(0, Math.min(7, Number(str(form, "sessions_per_week"))));
    training!.mobility.minutes = Math.max(0, Math.min(90, Number(str(form, "minutes"))));
  } else if (op === "params") {
    const neat = str(form, "neat_level") as NeatLevel;
    params = {
      ...params,
      start_date: str(form, "start_date") || params.start_date,
      calorie_mode: str(form, "calorie_mode") === "fixed" ? "fixed" : "deficit",
      deficit: num(form, "deficit") ?? params.deficit,
      target_override: num(form, "target_override"),
      bmr_method: str(form, "bmr_method") === "katch" ? "katch" : "mifflin",
      neat_level: neat in NEAT_FACTORS ? neat : params.neat_level,
      energy_mode: str(form, "energy_mode") === "measured" ? "measured" : "formula",
      reference_weight: str(form, "reference_weight") === "goal" ? "goal" : "current",
      protein_g_per_lb: num(form, "protein_g_per_lb"),
      fat_pct: num(form, "fat_pct"),
      checkpoint_weeks: str(form, "checkpoint_weeks").split(",").map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= params.weeks),
    };
    if (params.calorie_mode === "fixed" && !params.target_override) return { error: "Enter the fixed calorie target." };
    if (params.deficit < -1000 || params.deficit > 1500) return { error: "Deficit must be between −1,000 and 1,500 kcal/day." };
  } else {
    return { error: "Unknown edit." };
  }
  return recomputeAndSave(db, plan, params, training);
}

export async function saveOverrideAction(planId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const db = createClient();
  const reason = str(form, "reason");
  if (!reason) return { error: "Enter a reason for the override." };
  const plan = await getPlan(db, planId);
  if (!plan) return { error: "Plan not found" };
  const flag = plan.guardrail_flags.find((f) => f.rule_key === str(form, "rule_key"));
  if (!flag) return { error: "Unknown rule." };
  if (flag.status === "blocked") return { error: "Blocked rules cannot be overridden." };
  const { error } = await db.from("guardrail_overrides").insert({ plan_id: planId, rule_key: flag.rule_key, original_value: flag.value ?? null, override_value: flag.value ?? null, reason });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${plan.client_id}/plan/${planId}`);
  return { error: null, ok: true };
}

export async function approvePlanAction(planId: string, _prev: ActionState): Promise<ActionState> {
  const db = createClient();
  let plan: PlanRow;
  try {
    plan = await loadDraft(db, planId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Re-run the deterministic pipeline so approval sees current flags.
  const refreshed = await recomputeAndSave(db, plan, plan.parameters, plan.training);
  if (refreshed.error) return refreshed;
  plan = (await getPlan(db, planId))!;
  const issues = await approvalIssues(db, plan);
  if (issues.length) return { error: "Cannot approve yet.", details: issues };

  const e = plan.nutrition?.energy;
  const params: PlanParameters = {
    ...plan.parameters,
    start_weight_lb: plan.parameters.weight_lb,
    start_rate_lb_per_week: e?.predicted_lb_per_week ?? 0,
    start_band_half_width: e ? (e.predicted_high - e.predicted_low) / 2 : 0.25,
  };
  await db.from("plans").update({ status: "archived" }).eq("client_id", plan.client_id).eq("status", "approved");
  const { error } = await db.from("plans").update({ status: "approved", approved_at: new Date().toISOString(), parameters: params }).eq("id", planId);
  if (error) return { error: error.message };

  // Checkpoints: calibration reviews, retests, measurements.
  const p = { start_date: params.start_date, weeks: params.weeks, lifting_days: plan.training?.lifting_days ?? [] };
  const rows: { client_id: string; plan_id: string; week: number; kind: string; due_date: string }[] = [];
  for (const wk of params.checkpoint_weeks) rows.push({ client_id: plan.client_id, plan_id: planId, week: wk, kind: "review", due_date: checkpointDate(p, wk) });
  for (const w of plan.training?.weeks ?? []) if (w.retest) rows.push({ client_id: plan.client_id, plan_id: planId, week: w.week, kind: "retest", due_date: retestDate(p, w.week) });
  for (let wk = 1; wk <= params.weeks; wk += 4) rows.push({ client_id: plan.client_id, plan_id: planId, week: wk, kind: "measurements", due_date: weekStart(params.start_date, wk) });
  rows.push({ client_id: plan.client_id, plan_id: planId, week: params.weeks, kind: "measurements", due_date: planEndDate(p) });
  await db.from("checkpoints").insert(rows);

  // Client becomes active on the plan's start date.
  const { data: client } = await db.from("clients").select("start_date, status").eq("id", plan.client_id).single();
  await db.from("clients").update({ status: client?.status === "prospect" || client?.status === "paused" ? "active" : client?.status ?? "active", start_date: client?.start_date ?? params.start_date }).eq("id", plan.client_id);

  // Preset benchmarks by goal (editable per client) if none yet.
  const { data: existing } = await db.from("benchmarks").select("id").eq("client_id", plan.client_id).limit(1);
  if (!existing?.length) {
    const intake = await latestIntake(db, plan.client_id);
    await db.from("benchmarks").insert(
      PRESET_BENCHMARKS[plan.goal_category].map((b) => ({
        client_id: plan.client_id,
        plan_id: planId,
        ...b,
        baseline: b.name === "Body weight" ? intake?.answers.weight_lb ?? null : null,
        target: b.name === "Body weight" ? intake?.answers.goal_weight_lb ?? null : null,
        target_date: planEndDate(p),
      })),
    );
  }
  revalidatePath(`/clients/${plan.client_id}`);
  return { error: null, ok: true };
}

/** Copy an approved (or archived) plan into a new draft version for editing. */
export async function revisePlanAction(planId: string) {
  const db = createClient();
  const plan = await getPlan(db, planId);
  if (!plan) throw new Error("Plan not found");
  const version = await nextVersion(db, plan.client_id);
  await db.from("plans").update({ status: "archived" }).eq("client_id", plan.client_id).eq("status", "draft");
  const { data, error } = await db
    .from("plans")
    .insert({ client_id: plan.client_id, version, goal_category: plan.goal_category, status: "draft", parameters: plan.parameters, training: plan.training, nutrition: plan.nutrition, guardrail_flags: plan.guardrail_flags })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/clients/${plan.client_id}/plan/${data.id}`);
}
