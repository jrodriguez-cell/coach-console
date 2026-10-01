/**
 * Progress calculations: weight trend and status, trajectory, strength
 * (Epley e1RM / 5RM), PRs, progression readiness, benchmarks, adherence and
 * volume. Pure; unit-tested.
 */
import { addDays, daysBetween, mondayOnOrBefore } from "./dates";
import { adherenceFromDaily } from "./calibration";

export interface Point {
  date: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

/** 7-day trend: mean of weigh-ins in the trailing 7 days (inclusive). */
export function trend7(points: Point[]): Point[] {
  const s = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return s.map((p) => {
    const win = s.filter((q) => q.date <= p.date && daysBetween(q.date, p.date) < 7);
    return { date: p.date, value: win.reduce((a, q) => a + q.value, 0) / win.length };
  });
}

export interface TrajectoryPoint {
  date: string;
  week: number;
  planned: number;
  low: number;
  high: number;
}

/** Planned weight by week with the energy model's uncertainty band. */
export function plannedTrajectory(p: { startDate: string; startWeight: number; plannedLbPerWeek: number; bandHalfWidthLbPerWeek: number; weeks: number }): TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (let w = 0; w <= p.weeks; w++) {
    const planned = p.startWeight + p.plannedLbPerWeek * w;
    out.push({ date: addDays(p.startDate, w * 7), week: w, planned, low: planned - p.bandHalfWidthLbPerWeek * w, high: planned + p.bandHalfWidthLbPerWeek * w });
  }
  return out;
}

export function plannedAt(p: { startDate: string; startWeight: number; plannedLbPerWeek: number }, date: string): number {
  return p.startWeight + (p.plannedLbPerWeek * daysBetween(p.startDate, date)) / 7;
}

export type WeightStatus = "on_track" | "slightly_behind" | "behind" | "ahead" | "no_data";

export const WEIGHT_STATUS_LABEL: Record<WeightStatus, string> = {
  on_track: "On track",
  slightly_behind: "Slightly behind",
  behind: "Behind",
  ahead: "Ahead — check strength and energy",
  no_data: "No weigh-ins yet",
};

export interface WeightSummary {
  status: WeightStatus;
  latest: Point | null;
  latestTrend: number | null;
  plannedNow: number | null;
  deviation: number | null;
  tolerance: number;
  cumulativeChange: number | null;
  lbsToGoal: number | null;
  observedLbPerWeek: number | null;
  plannedLbPerWeek: number;
}

/**
 * Status of the latest 7-day trend vs. the planned trajectory. Tolerance is
 * the energy-model band at that date (at least `minToleranceLb`).
 */
export function weightStatus(p: {
  weighIns: Point[];
  startDate: string;
  startWeight: number;
  plannedLbPerWeek: number;
  bandHalfWidthLbPerWeek: number;
  goalWeight?: number | null;
  minToleranceLb?: number;
}): WeightSummary {
  const pts = [...p.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const base = { plannedLbPerWeek: p.plannedLbPerWeek, tolerance: p.minToleranceLb ?? 1 };
  if (pts.length === 0) {
    return { ...base, status: "no_data", latest: null, latestTrend: null, plannedNow: null, deviation: null, cumulativeChange: null, lbsToGoal: null, observedLbPerWeek: null };
  }
  const latest = pts[pts.length - 1];
  const tr = trend7(pts);
  const latestTrend = tr[tr.length - 1].value;
  const plannedNow = plannedAt(p, latest.date);
  const weeks = Math.max(0, daysBetween(p.startDate, latest.date) / 7);
  const tolerance = Math.max(p.minToleranceLb ?? 1, p.bandHalfWidthLbPerWeek * weeks);
  const deviation = latestTrend - plannedNow;
  const dir = Math.sign(p.plannedLbPerWeek);
  let status: WeightStatus;
  if (Math.abs(deviation) <= tolerance) status = "on_track";
  else if (dir === 0) status = Math.abs(deviation) > 2 * tolerance ? "behind" : "slightly_behind";
  else {
    const behind = dir < 0 ? deviation : -deviation; // positive = behind plan
    status = behind > 2 * tolerance ? "behind" : behind > tolerance ? "slightly_behind" : "ahead";
  }
  const recent = pts.filter((q) => daysBetween(q.date, latest.date) <= 28);
  return {
    ...base,
    tolerance,
    status,
    latest,
    latestTrend,
    plannedNow,
    deviation,
    cumulativeChange: latest.value - pts[0].value,
    lbsToGoal: p.goalWeight != null ? latest.value - p.goalWeight : null,
    observedLbPerWeek: recent.length >= 2 ? slopePerWeek(recent) : null,
  };
}

export function slopePerWeek(points: Point[]): number {
  const t0 = points[0].date;
  const xs = points.map((p) => daysBetween(t0, p.date));
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? 0 : (num / den) * 7;
}

/** Consecutive weigh-ins (most recent first) whose trend is off plan by more than the tolerance. */
export function consecutiveOffTrajectory(p: { weighIns: Point[]; startDate: string; startWeight: number; plannedLbPerWeek: number; bandHalfWidthLbPerWeek: number; minToleranceLb?: number }): { count: number; latestDate: string | null } {
  const tr = trend7(p.weighIns);
  let count = 0;
  for (let i = tr.length - 1; i >= 0; i--) {
    const weeks = Math.max(0, daysBetween(p.startDate, tr[i].date) / 7);
    const tol = Math.max(p.minToleranceLb ?? 1, p.bandHalfWidthLbPerWeek * weeks);
    if (Math.abs(tr[i].value - plannedAt(p, tr[i].date)) > tol) count++;
    else break;
  }
  return { count, latestDate: tr.length ? tr[tr.length - 1].date : null };
}

// ---------------------------------------------------------------------------
// Strength
// ---------------------------------------------------------------------------

/** Epley e1RM = weight × (1 + reps/30); with RPE, reps + (10 − RPE) reps in reserve. */
export function e1rm(weight: number, reps: number, rpe?: number | null): number {
  const rir = rpe != null ? Math.max(0, 10 - rpe) : 0;
  return weight * (1 + (reps + rir) / 30);
}

export function fiveRm(e1: number): number {
  return e1 / (1 + 5 / 30);
}

export interface SetLog {
  date: string;
  exercise_id: string;
  exercise_name?: string;
  set_number: number;
  weight_lb: number | null;
  reps: number | null;
  rpe: number | null;
  is_test: boolean;
}

export function bestE1rmByDate(sets: SetLog[]): Point[] {
  const by = new Map<string, number>();
  for (const s of sets) {
    if (s.weight_lb == null || s.reps == null || s.reps <= 0) continue;
    const v = e1rm(s.weight_lb, s.reps, s.rpe);
    by.set(s.date, Math.max(by.get(s.date) ?? 0, v));
  }
  return Array.from(by.entries()).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

export interface LiftSummary {
  exercise_id: string;
  exercise_name: string;
  baseline5rm: number | null;
  latest5rm: number | null;
  pctOfBaseline: number | null;
  flagLow: boolean;
  history: Point[];
  prs: Point[];
}

/**
 * Baseline = first test (or first logged session), latest = latest test (or
 * latest session). Flag below `retentionPct` of baseline for weight loss.
 */
export function liftSummary(sets: SetLog[], opts: { flagBelowPct?: number | null } = {}): LiftSummary[] {
  const byEx = new Map<string, SetLog[]>();
  for (const s of sets) (byEx.get(s.exercise_id) ?? byEx.set(s.exercise_id, []).get(s.exercise_id)!).push(s);
  const out: LiftSummary[] = [];
  for (const [id, list] of byEx) {
    const tests = list.filter((s) => s.is_test);
    const history = bestE1rmByDate(list);
    const testHist = bestE1rmByDate(tests);
    const baseSrc = testHist.length ? testHist : history;
    const baseline = baseSrc[0]?.value ?? null;
    const latestSrc = testHist.length >= 2 ? testHist : history;
    const latest = latestSrc.length ? latestSrc[latestSrc.length - 1].value : null;
    const pct = baseline && latest ? (latest / baseline) * 100 : null;
    out.push({
      exercise_id: id,
      exercise_name: list[0].exercise_name ?? id,
      baseline5rm: baseline != null ? fiveRm(baseline) : null,
      latest5rm: latest != null ? fiveRm(latest) : null,
      pctOfBaseline: pct,
      flagLow: opts.flagBelowPct != null && pct != null && pct < opts.flagBelowPct,
      history: history.map((h) => ({ date: h.date, value: fiveRm(h.value) })),
      prs: personalRecords(history),
    });
  }
  return out.sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));
}

/** Dates where the best e1RM exceeded every earlier session (excluding the first). */
export function personalRecords(history: Point[]): Point[] {
  const prs: Point[] = [];
  let best = -Infinity;
  history.forEach((h, i) => {
    if (h.value > best + 1e-9) {
      if (i > 0) prs.push(h);
      best = h.value;
    }
  });
  return prs;
}

export type Readiness = "add_weight" | "not_yet" | "rpe_not_logged" | "no_data";

/**
 * Double progression: when every working set of the last session hit the
 * top of the rep range at RPE 8 or easier → add weight next session.
 */
export function progressionReadiness(lastSessionSets: SetLog[], repsMax: number): Readiness {
  const work = lastSessionSets.filter((s) => !s.is_test && s.reps != null);
  if (work.length === 0) return "no_data";
  if (!work.every((s) => (s.reps ?? 0) >= repsMax)) return "not_yet";
  if (work.some((s) => s.rpe == null)) return "rpe_not_logged";
  return work.every((s) => (s.rpe ?? 10) <= 8) ? "add_weight" : "not_yet";
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

export interface BenchmarkLike {
  direction: "higher_better" | "lower_better";
  baseline: number | null;
  target: number | null;
  target_date: string | null;
  created_at: string; // date
}

export type BenchmarkStatus = "achieved" | "on_track" | "behind" | "no_target" | "no_data";

export function benchmarkProgress(b: BenchmarkLike, current: number | null, asOf: string): { pct: number | null; status: BenchmarkStatus; expectedPct: number | null } {
  if (current == null || b.baseline == null) return { pct: null, status: "no_data", expectedPct: null };
  if (b.target == null || b.target === b.baseline) return { pct: null, status: "no_target", expectedPct: null };
  const pct = ((current - b.baseline) / (b.target - b.baseline)) * 100;
  const achieved = b.direction === "higher_better" ? current >= b.target : current <= b.target;
  if (achieved) return { pct: Math.max(100, pct), status: "achieved", expectedPct: 100 };
  if (!b.target_date) return { pct, status: pct >= 0 ? "on_track" : "behind", expectedPct: null };
  const total = Math.max(1, daysBetween(b.created_at, b.target_date));
  const elapsed = Math.min(total, Math.max(0, daysBetween(b.created_at, asOf)));
  const expectedPct = (elapsed / total) * 100;
  return { pct, status: pct >= expectedPct - 10 ? "on_track" : "behind", expectedPct };
}

// ---------------------------------------------------------------------------
// Adherence and volume
// ---------------------------------------------------------------------------

export interface SessionLog {
  date: string;
  status: "completed" | "partial" | "missed" | "rest_swap";
}

export function sessionCompletion(sessions: SessionLog[], scheduled: number): { completed: number; scheduled: number; pct: number | null } {
  const completed = sessions.filter((s) => s.status === "completed").length + 0.5 * sessions.filter((s) => s.status === "partial").length;
  return { completed, scheduled, pct: scheduled > 0 ? Math.min(100, (completed / scheduled) * 100) : null };
}

/**
 * 14-day adherence used by the task rules: nutrition days on target when
 * daily data exist, else the weekly adherence % entries, else training
 * session completion.
 */
export function adherenceWindow(p: {
  daily: { date: string; calories: number | null; protein_g: number | null }[];
  weeklyAdherence: Point[];
  sessions: SessionLog[];
  scheduledSessions: number;
  target: { calories: number; calorieTol: number; proteinMin: number } | null;
}): { pct: number | null; source: "nutrition_daily" | "weekly_entry" | "sessions" | "none" } {
  if (p.target) {
    const d = adherenceFromDaily(p.daily, p.target);
    if (d != null) return { pct: d, source: "nutrition_daily" };
  }
  if (p.weeklyAdherence.length) return { pct: p.weeklyAdherence.reduce((a, x) => a + x.value, 0) / p.weeklyAdherence.length, source: "weekly_entry" };
  const s = sessionCompletion(p.sessions, p.scheduledSessions);
  if (s.pct != null) return { pct: s.pct, source: "sessions" };
  return { pct: null, source: "none" };
}

/** Weekly training volume (Σ weight × reps), keyed by Monday. */
export function weeklyVolume(sets: SetLog[]): Point[] {
  const by = new Map<string, number>();
  for (const s of sets) {
    if (s.weight_lb == null || s.reps == null) continue;
    const wk = mondayOnOrBefore(s.date);
    by.set(wk, (by.get(wk) ?? 0) + s.weight_lb * s.reps);
  }
  return Array.from(by.entries()).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

export function average(points: Point[]): number | null {
  return points.length ? points.reduce((a, p) => a + p.value, 0) / points.length : null;
}

/** Two consecutive entries below a threshold (most recent two). */
export function twoInARowBelow(points: Point[], threshold: number): string | null {
  const s = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) return null;
  const [a, b] = s.slice(-2);
  return a.value < threshold && b.value < threshold ? b.date : null;
}
