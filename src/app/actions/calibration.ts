"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { calibrationPreview } from "@/lib/data/calibration-data";
import { generatorContext, planOverrides } from "@/lib/data/clients";
import { deriveNutrition, diffDerived, type ChangeRow } from "@/lib/generator";
import { todayIn } from "@/lib/dates";
import type { CalibrationDecision } from "@/lib/calibration";
import type { PlanParameters } from "@/lib/plan-types";

export interface CalibrationState {
  error: string | null;
  details?: string[];
  ok?: boolean;
  changes?: ChangeRow[];
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveCalibrationAction(clientId: string, _prev: CalibrationState, form: FormData): Promise<CalibrationState> {
  const db = createClient();
  const settings = await getSettings(db);
  const adh = str(form, "adherence_pct");
  const preview = await calibrationPreview(db, clientId, str(form, "checkpoint_id") || null, settings, todayIn(), adh === "" ? null : Number(adh));
  if (!preview) return { error: "Calibration needs an approved plan with nutrition targets." };
  const { plan, result, input } = preview;
  if (input.adherencePct == null && result.decision !== "insufficient_data") return { error: "Enter the adherence % for this period (no daily or weekly adherence data was logged)." };

  const decision = (str(form, "decision") || result.decision) as CalibrationDecision;
  if (!["keep", "adjust", "fix_adherence", "insufficient_data"].includes(decision)) return { error: "Invalid decision." };
  const applied = decision === "adjust" ? Number(str(form, "applied_adjustment_kcal") || result.recommended_adjustment_kcal) : 0;
  if (!Number.isFinite(applied)) return { error: "Enter the calorie adjustment." };
  if (decision === "fix_adherence" && applied !== 0) return { error: "Fix-adherence decisions do not change calories." };
  const note = str(form, "note");

  let changes: ChangeRow[] = [];
  // keep/adjust recalibrate the model: current weight, this week's program, calibrated uncertainty.
  if (decision === "keep" || decision === "adjust") {
    const ctx = await generatorContext(db, clientId, settings, plan.goal_category);
    const successful = result.weigh_in_points >= 3 && result.span_days >= 14;
    const params: PlanParameters = {
      ...plan.parameters,
      calorie_mode: "fixed",
      target_override: plan.nutrition.targets!.calories + applied,
      weight_lb: preview.latestWeight ?? plan.parameters.weight_lb,
      energy_week: preview.checkpoint?.week ?? preview.planWeek,
      uncertainty_pct: successful ? settings.uncertainty.calibrated : plan.parameters.uncertainty_pct,
    };
    const derived = deriveNutrition(ctx, params, plan.training);
    const blocked = derived.guardrail_flags.filter((f) => f.status === "blocked");
    if (blocked.length) return { error: "That adjustment breaks a hard guardrail.", details: blocked.map((b) => `${b.label}: ${b.message}`) };
    const warns = derived.guardrail_flags.filter((f) => f.status === "warn");
    const existing = await planOverrides(db, plan.id);
    const needReason = warns.filter((w) => !existing.some((o) => o.rule_key === w.rule_key));
    if (needReason.length && !note) return { error: "This adjustment triggers guardrail warnings; enter a decision note (it is saved as the override reason).", details: needReason.map((w) => `${w.label}: ${w.message}`) };
    if (needReason.length) {
      await db.from("guardrail_overrides").insert(needReason.map((w) => ({ plan_id: plan.id, rule_key: w.rule_key, original_value: w.value ?? null, override_value: w.value ?? null, reason: `Calibration: ${note}` })));
    }
    changes = diffDerived({ energy: plan.nutrition.energy, nutrition: plan.nutrition }, derived);
    const nutrition = { ...derived.nutrition, training_blocked_reason: plan.nutrition.training_blocked_reason ?? null };
    const { error } = await db.from("plans").update({ parameters: params, nutrition, guardrail_flags: derived.guardrail_flags }).eq("id", plan.id);
    if (error) return { error: error.message };
    if (derived.energy) await db.from("energy_models").insert({ plan_id: plan.id, mode: derived.energy.mode, inputs: params, outputs: derived.energy, uncertainty_pct: derived.energy.uncertainty_pct });
  }

  const { error } = await db.from("calibrations").insert({
    client_id: clientId,
    plan_id: plan.id,
    checkpoint_id: preview.checkpoint?.id ?? null,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    weigh_in_points: result.weigh_in_points,
    observed_lb_per_week: result.observed_lb_per_week,
    planned_lb_per_week: result.planned_lb_per_week,
    adherence_pct: input.adherencePct,
    implied_daily_balance: result.implied_daily_balance,
    recommended_adjustment_kcal: result.recommended_adjustment_kcal,
    applied_adjustment_kcal: applied,
    decision,
    trainer_decision_note: note || null,
  });
  if (error) return { error: error.message };
  if (preview.checkpoint) {
    await db.from("checkpoints").update({ completed_at: new Date().toISOString(), result: { decision, applied_adjustment_kcal: applied, observed_lb_per_week: result.observed_lb_per_week, adherence_pct: input.adherencePct } }).eq("id", preview.checkpoint.id);
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/progress`);
  revalidatePath("/today");
  return { error: null, ok: true, changes };
}
