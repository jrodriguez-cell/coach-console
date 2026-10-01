import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, daysBetween } from "@/lib/dates";
import {
  adherenceWindow, benchmarkProgress, consecutiveOffTrajectory, liftSummary, sessionCompletion, twoInARowBelow, weightStatus,
  type BenchmarkStatus, type LiftSummary, type Point, type SessionLog, type SetLog, type WeightSummary,
} from "@/lib/progress";
import type { ClientSnapshot } from "@/lib/tasks";
import type { TaskThresholds } from "@/config/tasks";
import type { CalibrationRow, CheckpointRow, ClientRow, IntakeRow, MetricDefRow, PlanRow } from "./types";

export interface BenchmarkWithResults {
  id: string;
  client_id: string;
  plan_id: string | null;
  name: string;
  category: string;
  unit: string | null;
  direction: "higher_better" | "lower_better";
  baseline: number | null;
  target: number | null;
  target_date: string | null;
  metric_id: string | null;
  created_at: string;
  results: { id: string; date: string; value: number; note: string | null }[];
}

export interface ClientProgressData {
  client: ClientRow;
  plan: PlanRow | null;
  intake: IntakeRow | null;
  metrics: Record<string, Point[]>;
  /** metric key → metric id */
  metricIds?: Record<string, string>;
  notes: { date: string; text: string }[];
  sessions: (SessionLog & { id: string; planned_session_key: string | null; duration_min: number | null; avg_rpe: number | null; notes: string | null })[];
  sets: (SetLog & { session_id: string })[];
  measurements: { date: string; site: string; value: number }[];
  benchmarks: BenchmarkWithResults[];
  calibrations: CalibrationRow[];
  checkpoints: CheckpointRow[];
  lastContact: string | null;
  clearance: { status: "pending" | "received" | "not_required"; requested_at: string | null } | null;
}

export async function loadMetricDefs(db: SupabaseClient): Promise<MetricDefRow[]> {
  const { data } = await db.from("metric_definitions").select("*").order("display_order");
  return (data ?? []) as MetricDefRow[];
}

/** Load everything progress/tasks need for the given clients. */
export async function loadProgressData(db: SupabaseClient, clients: ClientRow[]): Promise<Map<string, ClientProgressData>> {
  const ids = clients.map((c) => c.id);
  const out = new Map<string, ClientProgressData>();
  if (ids.length === 0) return out;
  const [defs, entries, plans, intakes, sessions, measurements, benchmarks, calibrations, checkpoints, contacts, clearances] = await Promise.all([
    loadMetricDefs(db),
    db.from("metric_entries").select("client_id, metric_id, date, value_num, value_text").in("client_id", ids).order("date"),
    db.from("plans").select("*").in("client_id", ids).neq("status", "archived").order("version", { ascending: false }),
    db.from("intakes").select("*").in("client_id", ids).order("submitted_at", { ascending: false }),
    db.from("workout_sessions").select("*").in("client_id", ids).order("date"),
    db.from("measurements").select("client_id, date, site, value_in").in("client_id", ids).order("date"),
    db.from("benchmarks").select("*, results:benchmark_results(id, date, value, note)").in("client_id", ids).order("created_at"),
    db.from("calibrations").select("*").in("client_id", ids).order("created_at"),
    db.from("checkpoints").select("*").in("client_id", ids).order("due_date"),
    db.from("contact_log").select("client_id, date").in("client_id", ids).order("date", { ascending: false }),
    db.from("clearances").select("client_id, status, requested_at, created_at").in("client_id", ids).order("created_at", { ascending: false }),
  ]);
  type SessionRow = ClientProgressData["sessions"][number] & { client_id: string };
  const sessionRows = (sessions.data ?? []) as SessionRow[];
  const sessionClient = new Map(sessionRows.map((s) => [s.id, s.client_id]));
  const sessionIds = sessionRows.map((s) => s.id);
  const setRows: (SetLog & { session_id: string })[] = [];
  for (let i = 0; i < sessionIds.length; i += 200) {
    const { data } = await db.from("set_logs").select("session_id, exercise_id, set_number, weight_lb, reps, rpe, is_test, exercises(name)").in("session_id", sessionIds.slice(i, i + 200));
    for (const r of data ?? []) {
      const s = sessionRows.find((x) => x.id === r.session_id)!; // for the session date
      const ex = r.exercises as unknown as { name: string } | null;
      setRows.push({ session_id: r.session_id, date: s.date, exercise_id: r.exercise_id, exercise_name: ex?.name ?? "", set_number: r.set_number, weight_lb: r.weight_lb != null ? Number(r.weight_lb) : null, reps: r.reps, rpe: r.rpe != null ? Number(r.rpe) : null, is_test: r.is_test });
    }
  }
  const keyById = new Map(defs.map((d) => [d.id, d.key]));
  for (const c of clients) {
    const plansFor = ((plans.data ?? []) as PlanRow[]).filter((p) => p.client_id === c.id);
    const metrics: Record<string, Point[]> = {};
    const notes: { date: string; text: string }[] = [];
    for (const e of (entries.data ?? []).filter((x) => x.client_id === c.id)) {
      const key = keyById.get(e.metric_id) ?? e.metric_id;
      if (e.value_num != null) (metrics[key] ??= []).push({ date: e.date, value: Number(e.value_num) });
      else if (e.value_text) notes.push({ date: e.date, text: e.value_text });
    }
    const clr = (clearances.data ?? []).find((x) => x.client_id === c.id);
    out.set(c.id, {
      client: c,
      plan: plansFor.find((p) => p.status === "approved") ?? plansFor[0] ?? null,
      intake: ((intakes.data ?? []) as IntakeRow[]).find((i) => i.client_id === c.id) ?? null,
      metrics,
      metricIds: Object.fromEntries(defs.map((m) => [m.key, m.id])),
      notes,
      sessions: sessionRows.filter((s) => s.client_id === c.id),
      sets: setRows.filter((s) => sessionClient.get(s.session_id) === c.id),
      measurements: (measurements.data ?? []).filter((m) => m.client_id === c.id).map((m) => ({ date: m.date, site: m.site, value: Number(m.value_in) })),
      benchmarks: ((benchmarks.data ?? []) as BenchmarkWithResults[]).filter((b) => b.client_id === c.id).map((b) => ({ ...b, baseline: b.baseline != null ? Number(b.baseline) : null, target: b.target != null ? Number(b.target) : null, results: (b.results ?? []).map((r) => ({ ...r, value: Number(r.value) })).sort((x, y) => x.date.localeCompare(y.date)) })),
      calibrations: ((calibrations.data ?? []) as CalibrationRow[]).filter((x) => x.client_id === c.id),
      checkpoints: ((checkpoints.data ?? []) as CheckpointRow[]).filter((x) => x.client_id === c.id),
      lastContact: (contacts.data ?? []).find((x) => x.client_id === c.id)?.date ?? null,
      clearance: clr ? { status: clr.status, requested_at: clr.requested_at ?? clr.created_at?.slice(0, 10) ?? null } : null,
    });
  }
  return out;
}

export interface PlanMeta {
  startDate: string;
  startWeight: number;
  plannedLbPerWeek: number;
  bandHalfWidthLbPerWeek: number;
  weeks: number;
  liftingDaysPerWeek: number;
  calorieTarget: number | null;
  calorieTol: number | null;
  proteinMin: number | null;
  plannedCardioMinPerWeek: number | null;
}

export function planMeta(plan: PlanRow | null, intake: IntakeRow | null): PlanMeta | null {
  if (!plan) return null;
  const p = plan.parameters;
  const e = plan.nutrition?.energy;
  const t = plan.nutrition?.targets;
  const cw = plan.training?.cardio?.weeks?.[0];
  return {
    startDate: p.start_date,
    startWeight: p.start_weight_lb ?? p.weight_lb ?? intake?.answers.weight_lb ?? 0,
    plannedLbPerWeek: p.start_rate_lb_per_week ?? e?.predicted_lb_per_week ?? 0,
    bandHalfWidthLbPerWeek: p.start_band_half_width ?? (e ? (e.predicted_high - e.predicted_low) / 2 : 0.25),
    weeks: p.weeks,
    liftingDaysPerWeek: plan.training?.lifting_days?.length ?? 0,
    calorieTarget: t?.calories ?? null,
    calorieTol: t?.tolerance.calories ?? null,
    proteinMin: t ? t.protein_g - t.tolerance.protein_g : null,
    plannedCardioMinPerWeek: cw && !plan.training?.cardio.removed ? cw.sessions * cw.minutes : null,
  };
}

export interface ProgressSummary {
  meta: PlanMeta | null;
  week: number | null;
  weight: WeightSummary | null;
  lastWeighIn: string | null;
  lastCheckin: string | null;
  adherence14: number | null;
  adherenceSource: string;
  sessions14: { completed: number; scheduled: number; pct: number | null };
  cardio14: { actual: number | null; planned: number | null };
  lifts: LiftSummary[];
  strengthFlag: boolean;
  offTrajectory: { count: number; latestDate: string | null };
  energyLowDate: string | null;
  benchmarks: (BenchmarkWithResults & { current: number | null; pct: number | null; status: BenchmarkStatus; expectedPct: number | null })[];
  recentPrs: { label: string; date: string }[];
  benchmarkReached: { label: string; date: string }[];
}

export function summarize(d: ClientProgressData, today: string, T: TaskThresholds): ProgressSummary {
  const meta = planMeta(d.plan, d.intake);
  const weighIns = d.metrics.weight_lb ?? [];
  const since14 = addDays(today, -(T.adherenceWindowDays - 1));
  const within = (pts: Point[] | undefined) => (pts ?? []).filter((p) => p.date >= since14 && p.date <= today);
  const weight = meta ? weightStatus({ weighIns, startDate: meta.startDate, startWeight: meta.startWeight, plannedLbPerWeek: meta.plannedLbPerWeek, bandHalfWidthLbPerWeek: meta.bandHalfWidthLbPerWeek, goalWeight: d.intake?.answers.goal_weight_lb ?? null }) : null;
  const scheduled = meta && d.plan?.status === "approved" && meta.startDate <= today ? Math.round((meta.liftingDaysPerWeek * Math.min(T.adherenceWindowDays, daysBetween(meta.startDate, today) + 1)) / 7) : 0;
  const sess14 = d.sessions.filter((s) => s.date >= since14 && s.date <= today);
  const daily = within(d.metrics.calories).map((c) => ({ date: c.date, calories: c.value, protein_g: (d.metrics.protein_g ?? []).find((p) => p.date === c.date)?.value ?? null }));
  const adh = adherenceWindow({
    daily,
    weeklyAdherence: within(d.metrics.adherence_pct),
    sessions: sess14,
    scheduledSessions: scheduled,
    target: meta?.calorieTarget != null && meta.calorieTol != null && meta.proteinMin != null ? { calories: meta.calorieTarget, calorieTol: meta.calorieTol, proteinMin: meta.proteinMin } : null,
  });
  const isWL = (d.plan?.goal_category ?? d.client.goal_category) === "weight_loss";
  const lifts = liftSummary(d.sets, { flagBelowPct: isWL ? T.strengthRetentionPct : null });
  const checkinKeys = ["energy_1_10", "adherence_pct", "sleep_hrs", "stress_1_10"];
  const lastCheckin = checkinKeys.flatMap((k) => d.metrics[k] ?? []).reduce<string | null>((a, p) => (!a || p.date > a ? p.date : a), null);
  // Current value: latest test result, else the tracked data the benchmark describes.
  const tracked = (b: BenchmarkWithResults): number | null => {
    const last = (pts: Point[] | undefined) => (pts && pts.length ? pts[pts.length - 1].value : null);
    if (b.metric_id) {
      const e = Object.entries(d.metricIds ?? {}).find(([, id]) => id === b.metric_id);
      if (e) return last(d.metrics[e[0]]);
    }
    const n = b.name.toLowerCase();
    if (n === "body weight") return last(d.metrics.weight_lb);
    if (n === "weekly adherence") return last(d.metrics.adherence_pct);
    if (n === "average sleep") return last(d.metrics.sleep_hrs);
    if (n === "average energy") return last(d.metrics.energy_1_10);
    const site = ["waist", "chest", "hips", "arm", "thigh", "calf", "neck"].find((x) => n === x || n === `${x} circumference`);
    if (site) return last(d.measurements.filter((m) => m.site === site));
    return null;
  };
  const benchmarks = d.benchmarks.map((b) => {
    const current = b.results.length ? b.results[b.results.length - 1].value : tracked(b);
    const bp = benchmarkProgress({ direction: b.direction, baseline: b.baseline, target: b.target, target_date: b.target_date, created_at: b.created_at.slice(0, 10) }, current, today);
    return { ...b, current, ...bp };
  });
  const cardioActual = within(d.metrics.cardio_min);
  return {
    meta,
    week: meta ? Math.max(0, Math.min(meta.weeks, Math.floor(daysBetween(meta.startDate, today) / 7) + 1)) : null,
    weight,
    lastWeighIn: weighIns.length ? weighIns[weighIns.length - 1].date : null,
    lastCheckin,
    adherence14: adh.pct,
    adherenceSource: adh.source,
    sessions14: sessionCompletion(sess14, scheduled),
    cardio14: { actual: cardioActual.length ? cardioActual.reduce((a, p) => a + p.value, 0) : null, planned: meta?.plannedCardioMinPerWeek != null ? (meta.plannedCardioMinPerWeek * T.adherenceWindowDays) / 7 : null },
    lifts,
    strengthFlag: lifts.some((l) => l.flagLow),
    offTrajectory: meta ? consecutiveOffTrajectory({ weighIns, startDate: meta.startDate, startWeight: meta.startWeight, plannedLbPerWeek: meta.plannedLbPerWeek, bandHalfWidthLbPerWeek: meta.bandHalfWidthLbPerWeek }) : { count: 0, latestDate: null },
    energyLowDate: twoInARowBelow(d.metrics.energy_1_10 ?? [], T.energyLow),
    benchmarks,
    recentPrs: lifts.flatMap((l) => l.prs.map((p) => ({ label: `PR on ${l.exercise_name}`, date: p.date }))),
    benchmarkReached: benchmarks.filter((b) => b.status === "achieved" && b.results.length).map((b) => ({ label: `Reached benchmark: ${b.name}`, date: b.results[b.results.length - 1].date })),
  };
}

export function toSnapshot(d: ClientProgressData, s: ProgressSummary): ClientSnapshot {
  const plan = d.plan;
  const lastActivity = [d.lastContact, s.lastWeighIn, s.lastCheckin, d.sessions.at(-1)?.date ?? null, d.intake?.submitted_at.slice(0, 10) ?? null].reduce<string | null>((a, x) => (x && (!a || x > a) ? x : a), null);
  return {
    client: { id: d.client.id, name: d.client.name, status: d.client.status, goal_category: d.client.goal_category, start_date: d.client.start_date, created_at: d.client.created_at },
    plan: plan
      ? {
          id: plan.id,
          status: plan.status,
          start_date: plan.parameters.start_date,
          weeks: plan.parameters.weeks,
          checkpoint_weeks: plan.parameters.checkpoint_weeks ?? [],
          lifting_days: plan.training?.lifting_days ?? [],
          retest_weeks: (plan.training?.weeks ?? []).filter((w) => w.retest).map((w) => w.week),
          goal_category: plan.goal_category,
        }
      : null,
    intakeSubmitted: Boolean(d.intake),
    parqFlagged: Boolean(d.intake?.parq_flagged),
    clearance: d.clearance,
    weighIns: (d.metrics.weight_lb ?? []).map((p) => p.date),
    lastContact: d.lastContact,
    lastSession: d.sessions.filter((x) => x.status === "completed" || x.status === "partial").at(-1)?.date ?? null,
    lastActivity,
    adherence14: s.adherence14,
    offTrajectory: s.offTrajectory,
    strengthDrops: s.lifts.filter((l) => l.flagLow).map((l) => ({ exercise: l.exercise_name, date: l.history.at(-1)?.date ?? "" })),
    energyLowDate: s.energyLowDate,
    celebrations: [...s.recentPrs, ...s.benchmarkReached],
    checkinFlags: [],
    checkpointsDone: d.checkpoints.filter((c) => c.kind === "review" && c.completed_at).map((c) => c.week),
  };
}
