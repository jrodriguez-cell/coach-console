/**
 * Progress toward the client's goal, combining training and nutrition, for
 * the client Overview. Pure: built from the same progress data and summary
 * the Progress page uses.
 */
import { addDays, daysBetween, weekStart } from "./dates";
import { plannedTrajectory, WEIGHT_STATUS_LABEL } from "./progress";
import { adherenceFromDaily } from "./calibration";
import { plannedItemsForWeek, workoutAdherence } from "./schedule";
import { SKILLS } from "@/config/skills";
import { EXERCISES } from "@/data/exercises";
import type { ClientProgressData, ProgressSummary } from "./data/progress-data";

export type GoalKind = "weight" | "benchmark" | "skill" | "none";
export type GoalStatus = "ahead" | "on_track" | "behind" | "achieved" | "no_data";

export interface GoalPoint {
  week: number;
  value: number | null;
  /** planned value (weight) or target line */
  planned: number | null;
}

export interface WeeklyAdherence {
  week: number;
  training: number | null;
  nutrition: number | null;
}

export interface GoalOverview {
  kind: GoalKind;
  /** e.g. "Body weight: 270 → 250 lb" */
  title: string;
  /** 0–100 (can exceed 100 when beaten) */
  pct: number | null;
  /** where they'd be by now if on pace, 0–100 */
  expectedPct: number | null;
  status: GoalStatus;
  statusLabel: string;
  /** one line: "13.2 of 20 lb lost" */
  detail: string;
  unit: string;
  series: GoalPoint[];
  /** for skills: step names (index = value − 1) */
  steps?: string[];
  training: { pct: number | null; detail: string };
  nutrition: { pct: number | null; detail: string };
  overall: number | null;
  weekly: WeeklyAdherence[];
  currentWeek: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const statusFromPace = (pct: number, expected: number | null): GoalStatus => (pct >= 100 ? "achieved" : expected == null ? "on_track" : pct >= expected + 10 ? "ahead" : pct >= expected - 10 ? "on_track" : "behind");
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = { ahead: "Ahead of pace", on_track: "On track", behind: "Behind pace", achieved: "Goal reached", no_data: "Not enough data yet" };

export function goalOverview(d: ClientProgressData, s: ProgressSummary, today: string): GoalOverview {
  const meta = s.meta;
  const plan = d.plan;
  const weeks = meta?.weeks ?? 0;
  const currentWeek = meta ? clamp(Math.floor(daysBetween(meta.startDate, today) / 7) + 1, 1, weeks) : 0;
  const weekRange = (w: number) => {
    const from = weekStart(meta!.startDate, w);
    const to = addDays(from, 6);
    return { from, to: to > today ? today : to };
  };

  // ---- Weekly adherence: workouts done vs planned, food logs on target -----
  const weekly: WeeklyAdherence[] = [];
  if (meta && plan?.status === "approved" && plan.training && meta.startDate <= today) {
    for (let w = 1; w <= currentWeek; w++) {
      const { from, to } = weekRange(w);
      const wa = workoutAdherence(plannedItemsForWeek(plan.parameters, plan.training, w), d.sessions, from, to, {
        cardioMinutesLogged: (d.metrics.cardio_min ?? []).filter((p) => p.date >= from && p.date <= to).reduce((a, p) => a + p.value, 0),
      });
      let nutrition: number | null = null;
      if (meta.calorieTarget != null && meta.calorieTol != null && meta.proteinMin != null) {
        const days = (d.metrics.calories ?? []).filter((c) => c.date >= from && c.date <= to).map((c) => ({ date: c.date, calories: c.value, protein_g: (d.metrics.protein_g ?? []).find((p) => p.date === c.date)?.value ?? null }));
        nutrition = adherenceFromDaily(days, { calories: meta.calorieTarget, calorieTol: meta.calorieTol, proteinMin: meta.proteinMin });
      }
      weekly.push({ week: w, training: wa.pct, nutrition });
    }
  }

  const w = s.adherenceWorkouts;
  const training = { pct: w.pct, detail: w.due ? `${fmt1(w.done)} of ${w.due} workouts done (last 14 days)` : "No workouts due yet" };
  const nutrition = s.adherenceNutrition != null
    ? { pct: s.adherenceNutrition, detail: "Days on calorie and protein target (food logs)" }
    : { pct: null, detail: meta?.calorieTarget ? `No food logs yet · target ${Math.round(meta.calorieTarget)} kcal` : "No nutrition targets" };
  const base = { training, nutrition, overall: s.adherence14, weekly, currentWeek };

  // ---- Goal measure --------------------------------------------------------
  const skill = plan?.training?.skill ?? null;
  const goalWeight = d.intake?.answers.goal_weight_lb ?? null;
  const goal = d.plan?.goal_category ?? d.client.goal_category;
  const withTarget = s.benchmarks.filter((b) => b.target != null && b.baseline != null);
  const skillBench = skill ? withTarget.find((b) => b.name.toLowerCase().includes(SKILLS[skill].label.toLowerCase())) : undefined;

  // 1. A benchmark named after the skill goal (e.g. "L-sit hold", seconds).
  if (skillBench) return { ...benchmarkGoal(skillBench, meta?.startDate ?? null, weeks), ...base };

  // 2. Body weight toward the goal weight.
  if (goalWeight && meta && (goal === "weight_loss" || goal === "muscle_gain" || !withTarget.length)) {
    const start = meta.startWeight;
    const now = s.weight?.latestTrend ?? s.weight?.latest?.value ?? null;
    const total = goalWeight - start;
    if (now != null && Math.abs(total) > 0.1) {
      const pct = ((now - start) / total) * 100;
      const plannedNow = s.weight?.plannedNow ?? null;
      const expectedPct = plannedNow != null ? clamp(((plannedNow - start) / total) * 100, 0, 100) : null;
      const traj = plannedTrajectory({ startDate: meta.startDate, startWeight: start, plannedLbPerWeek: meta.plannedLbPerWeek, bandHalfWidthLbPerWeek: meta.bandHalfWidthLbPerWeek, weeks });
      const series: GoalPoint[] = [];
      for (let wk = 1; wk <= Math.max(currentWeek, 1); wk++) {
        const { from, to } = weekRange(wk);
        const pts = (d.metrics.weight_lb ?? []).filter((p) => p.date >= from && p.date <= addDays(from, 6));
        const planned = traj.find((t) => t.date >= addDays(from, 6)) ?? traj.at(-1);
        series.push({ week: wk, value: pts.length ? round1(pts.reduce((a, p) => a + p.value, 0) / pts.length) : null, planned: planned ? round1(planned.planned) : null });
        void to;
      }
      const moved = Math.abs(now - start);
      const status = pct >= 100 ? "achieved" : s.weight?.status === "ahead" ? "ahead" : s.weight?.status === "on_track" ? "on_track" : s.weight?.status === "no_data" ? "no_data" : "behind";
      return {
        kind: "weight",
        title: `Body weight: ${fmt1(start)} → ${fmt1(goalWeight)} lb`,
        pct: Math.max(0, pct),
        expectedPct,
        status,
        statusLabel: s.weight ? WEIGHT_STATUS_LABEL[s.weight.status] : GOAL_STATUS_LABEL[status],
        detail: `${fmt1(moved)} of ${fmt1(Math.abs(total))} lb ${total < 0 ? "lost" : "gained"} · now ${fmt1(now)} lb`,
        unit: "lb",
        series,
        ...base,
      };
    }
  }

  // 3. The skill ladder: highest step logged so far.
  if (skill) {
    const ladder = SKILLS[skill].ladder;
    const names = ladder.map((slug) => EXERCISES.find((e) => e.slug === slug)?.name ?? slug);
    const stepOf = (exerciseName: string) => names.indexOf(exerciseName);
    const logged = d.sets.map((x) => ({ date: x.date, step: stepOf(x.exercise_name ?? "") })).filter((x) => x.step >= 0);
    const best = logged.reduce((a, x) => Math.max(a, x.step), -1);
    const series: GoalPoint[] = [];
    if (meta) {
      let running = -1;
      for (let wk = 1; wk <= Math.max(currentWeek, 1); wk++) {
        const { from } = weekRange(wk);
        const to = addDays(from, 6);
        const inWeek = logged.filter((x) => x.date >= from && x.date <= to).reduce((a, x) => Math.max(a, x.step), -1);
        running = Math.max(running, inWeek);
        series.push({ week: wk, value: running >= 0 ? running + 1 : null, planned: ladder.length });
      }
    }
    const pct = best >= 0 ? ((best + 1) / ladder.length) * 100 : 0;
    // Pace: the plan moves up one step per 4-week block from the starting step.
    const expectedSteps = meta ? Math.min(ladder.length, Math.ceil(currentWeek / 4)) : null;
    const expectedPct = expectedSteps != null ? (expectedSteps / ladder.length) * 100 : null;
    return {
      kind: "skill",
      title: `${SKILLS[skill].label} progression`,
      pct,
      expectedPct,
      status: best < 0 ? "no_data" : statusFromPace(pct, expectedPct),
      statusLabel: best < 0 ? "No skill sets logged yet" : GOAL_STATUS_LABEL[statusFromPace(pct, expectedPct)],
      detail: best >= 0 ? `Step ${best + 1} of ${ladder.length}: ${names[best]}` : `Starts at: ${names[0]}`,
      unit: "step",
      series,
      steps: names,
      ...base,
    };
  }

  // 4. Any benchmark with a target.
  if (withTarget.length) return { ...benchmarkGoal(withTarget[0], meta?.startDate ?? null, weeks), ...base };

  return { kind: "none", title: "Goal", pct: null, expectedPct: null, status: "no_data", statusLabel: GOAL_STATUS_LABEL.no_data, detail: "Add a goal weight or a benchmark with a target to track progress toward the goal.", unit: "", series: [], ...base };
}

function benchmarkGoal(b: ProgressSummary["benchmarks"][number], startDate: string | null, weeks: number): Omit<GoalOverview, "training" | "nutrition" | "overall" | "weekly" | "currentWeek"> {
  const status: GoalStatus = b.status === "achieved" ? "achieved" : b.status === "behind" ? "behind" : b.status === "on_track" ? (b.expectedPct != null && b.pct != null && b.pct >= b.expectedPct + 10 ? "ahead" : "on_track") : "no_data";
  const series: GoalPoint[] = [];
  if (startDate) {
    const byWeek = new Map<number, number>();
    for (const r of b.results) {
      const wk = Math.floor(daysBetween(startDate, r.date) / 7) + 1;
      if (wk >= 1 && wk <= weeks) byWeek.set(wk, r.value);
    }
    for (const [wk, v] of Array.from(byWeek.entries()).sort((x, y) => x[0] - y[0])) series.push({ week: wk, value: v, planned: b.target });
  }
  return {
    kind: "benchmark",
    title: `${b.name}: ${fmt1(b.baseline!)} → ${fmt1(b.target!)}${b.unit ? ` ${b.unit}` : ""}`,
    pct: b.pct != null ? Math.max(0, b.pct) : null,
    expectedPct: b.expectedPct,
    status,
    statusLabel: GOAL_STATUS_LABEL[status],
    detail: b.current != null ? `Now ${fmt1(b.current)}${b.unit ? ` ${b.unit}` : ""}` : "No result yet",
    unit: b.unit ?? "",
    series,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt1 = (n: number) => (Number.isInteger(round1(n)) ? String(round1(n)) : round1(n).toFixed(1));
