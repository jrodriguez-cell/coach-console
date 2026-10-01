import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adherenceFromDaily, averageWeeklyAdherence, calibrate, type CalibrationInput, type CalibrationResult } from "@/lib/calibration";
import { daysBetween } from "@/lib/dates";
import { currentPlan } from "./clients";
import type { AppSettings } from "./settings";
import type { CheckpointRow, MetricDefRow, PlanRow } from "./types";

export interface CalibrationPreview {
  plan: PlanRow;
  checkpoint: CheckpointRow | null;
  input: CalibrationInput;
  result: CalibrationResult;
  adherenceSource: "override" | "daily_calories_protein" | "weekly_entries" | "none";
  weighIns: { date: string; weight: number }[];
  latestWeight: number | null;
  planWeek: number;
}

export async function calibrationPreview(db: SupabaseClient, clientId: string, checkpointId: string | null, settings: AppSettings, today: string, adherenceOverride: number | null): Promise<CalibrationPreview | null> {
  const plan = await currentPlan(db, clientId);
  if (!plan || plan.status !== "approved" || !plan.nutrition?.targets || !plan.nutrition.energy) return null;
  const checkpoint = checkpointId ? ((await db.from("checkpoints").select("*").eq("id", checkpointId).maybeSingle()).data as CheckpointRow | null) : null;
  const { data: lastCal } = await db.from("calibrations").select("period_end, decision").eq("client_id", clientId).eq("plan_id", plan.id).in("decision", ["keep", "adjust"]).order("created_at", { ascending: false }).limit(1);
  const periodStart = lastCal?.[0]?.period_end ?? plan.parameters.start_date;
  const periodEnd = today;

  const { data: defsData } = await db.from("metric_definitions").select("id, key").in("key", ["weight_lb", "calories", "protein_g", "adherence_pct"]);
  const defs = (defsData ?? []) as Pick<MetricDefRow, "id" | "key">[];
  const id = (k: string) => defs.find((d) => d.key === k)?.id ?? "";
  const { data: entries } = await db.from("metric_entries").select("metric_id, date, value_num").eq("client_id", clientId).in("metric_id", defs.map((d) => d.id)).gte("date", plan.parameters.start_date).lte("date", periodEnd).order("date");
  const series = (k: string) => (entries ?? []).filter((e) => e.metric_id === id(k) && e.value_num != null).map((e) => ({ date: e.date as string, value: Number(e.value_num) }));
  const weighIns = series("weight_lb").map((p) => ({ date: p.date, weight: p.value }));

  const t = plan.nutrition.targets;
  let adherence: number | null = null;
  let adherenceSource: CalibrationPreview["adherenceSource"] = "none";
  if (adherenceOverride != null) {
    adherence = adherenceOverride;
    adherenceSource = "override";
  } else {
    const inPeriod = (p: { date: string }) => p.date >= periodStart && p.date <= periodEnd;
    const daily = series("calories").filter(inPeriod).map((c) => ({ date: c.date, calories: c.value, protein_g: series("protein_g").find((p) => p.date === c.date)?.value ?? null }));
    const d = adherenceFromDaily(daily, { calories: t.calories, calorieTol: t.tolerance.calories, proteinMin: t.protein_g - t.tolerance.protein_g });
    if (d != null) {
      adherence = d;
      adherenceSource = "daily_calories_protein";
    } else {
      const w = averageWeeklyAdherence(series("adherence_pct").filter(inPeriod));
      if (w != null) {
        adherence = w;
        adherenceSource = "weekly_entries";
      }
    }
  }
  const e = plan.nutrition.energy;
  const input: CalibrationInput = {
    planStartDate: plan.parameters.start_date,
    periodStart,
    periodEnd,
    weighIns,
    plannedLbPerWeek: e.predicted_lb_per_week,
    plannedBand: { low: e.predicted_low, high: e.predicted_high },
    adherencePct: adherence,
    currentTargetKcal: t.calories,
    minCalories: settings.guardrail_limits.minCalories,
  };
  return {
    plan,
    checkpoint,
    input,
    result: calibrate(input),
    adherenceSource,
    weighIns,
    latestWeight: weighIns.at(-1)?.weight ?? null,
    planWeek: Math.max(1, Math.min(plan.parameters.weeks, Math.floor(daysBetween(plan.parameters.start_date, today) / 7) + 1)),
  };
}
