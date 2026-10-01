/**
 * Task engine. Pure: given a snapshot of one client, returns rule-based task
 * candidates. Idempotent by (client_id, rule_key, due_date) — the caller
 * upserts with "ignore duplicates", so re-running never creates copies.
 */
import { TASK_THRESHOLDS, type TaskThresholds } from "@/config/tasks";
import { addDays, dayOfWeek, daysBetween, mondayOnOrBefore, sundayOnOrBefore, weekStart } from "./dates";

export interface TaskCandidate {
  client_id: string;
  rule_key: string;
  due_date: string;
  title: string;
  kind: string;
}

export interface ClientSnapshot {
  client: { id: string; name: string; status: "prospect" | "active" | "paused" | "completed"; goal_category: string; start_date: string | null; created_at: string };
  plan: {
    id: string;
    status: "draft" | "approved" | "archived";
    start_date: string;
    weeks: number;
    checkpoint_weeks: number[];
    lifting_days: number[];
    retest_weeks: number[];
    goal_category: string;
  } | null;
  intakeSubmitted: boolean;
  parqFlagged: boolean;
  clearance: { status: "pending" | "received" | "not_required"; requested_at: string | null } | null;
  weighIns: string[]; // dates
  lastContact: string | null;
  lastSession: string | null;
  lastActivity: string | null;
  adherence14: number | null;
  offTrajectory: { count: number; latestDate: string | null };
  strengthDrops: { exercise: string; date: string }[];
  energyLowDate: string | null;
  celebrations: { label: string; date: string }[];
  checkinFlags: { date: string; reason: string }[];
  checkpointsDone: number[]; // weeks with completed calibration/review
}

export interface TaskOutput {
  create: TaskCandidate[];
  /** rule-based tasks whose condition is now resolved (auto-complete) */
  resolve: { client_id: string; rule_key: string; due_date: string }[];
}

const inWindow = (d: string, today: string, lookbackDays = 14) => d <= today && daysBetween(d, today) <= lookbackDays;

export function planEndDate(plan: { start_date: string; weeks: number }): string {
  return addDays(plan.start_date, plan.weeks * 7 - 1);
}

/** Retest day = the last lifting day of a deload/retest week. */
export function retestDate(plan: { start_date: string; lifting_days: number[] }, week: number): string {
  const ws = weekStart(plan.start_date, week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter((d) => plan.lifting_days.includes(dayOfWeek(d)));
  return days[days.length - 1] ?? addDays(ws, 6);
}

export function checkpointDate(plan: { start_date: string }, week: number): string {
  return addDays(weekStart(plan.start_date, week), 6);
}

export function generateTasks(s: ClientSnapshot, today: string, hourNow: number, T: TaskThresholds = TASK_THRESHOLDS): TaskOutput {
  const out: TaskOutput = { create: [], resolve: [] };
  const c = s.client;
  const add = (rule_key: string, due_date: string, title: string, kind: string) => out.create.push({ client_id: c.id, rule_key, due_date, title, kind });

  // --- Prospects -------------------------------------------------------------
  if (c.status === "prospect") {
    const last = s.lastActivity ?? s.lastContact ?? c.created_at.slice(0, 10);
    const due = addDays(last, T.prospectFollowUpDays);
    if (due <= today) add("prospect_followup", due, `Follow up with prospect ${c.name}`, "outreach");
    return out;
  }

  const plan = s.plan && s.plan.status !== "archived" ? s.plan : null;

  // --- Clearance (any non-prospect) -------------------------------------------
  if (s.parqFlagged && s.clearance?.status === "pending" && s.clearance.requested_at) {
    const due = addDays(s.clearance.requested_at, T.clearanceFollowUpDays);
    if (due <= today) add("clearance_followup", due, `Follow up with ${c.name} / physician office on clearance`, "clearance");
  }

  // --- Plan end and recheck (completed clients) ------------------------------
  if (c.status === "completed" && plan) {
    const end = planEndDate(plan);
    const recheck = addDays(end, T.recheckWeeksAfterEnd * 7);
    if (recheck <= today && daysBetween(recheck, today) <= 14) add("recheck", recheck, `${c.name}: ${T.recheckWeeksAfterEnd}-week post-program recheck`, "plan_end");
    return out;
  }
  if (c.status !== "active") return out;

  // --- Day 1 -----------------------------------------------------------------
  const start = plan?.start_date ?? c.start_date;
  if (start && inWindow(start, today, 14)) {
    add("day1_baseline", start, `Day 1: baseline weigh-in and measurements for ${c.name}`, "baseline");
    add("day1_confirm", start, `Day 1: confirm intake, PAR-Q and clearance status for ${c.name}`, "baseline");
  }

  // --- Outreach ----------------------------------------------------------------
  const lastContact = s.lastContact ?? start ?? c.created_at.slice(0, 10);
  const outreachDue = addDays(lastContact, T.outreachDays);
  if (outreachDue <= today) add("outreach", outreachDue, `Reach out to ${c.name}`, "outreach");
  for (const f of s.checkinFlags) if (inWindow(f.date, today)) add("checkin_followup", f.date, `Follow up with ${c.name}: ${f.reason}`, "outreach");

  if (!plan) return out;
  const end = planEndDate(plan);
  const planActive = plan.status === "approved" && plan.start_date <= today && today <= addDays(end, 7);

  if (planActive) {
    // --- Weekly Sunday weigh-in ------------------------------------------------
    const sunday = sundayOnOrBefore(today);
    if (sunday >= plan.start_date && sunday <= end) {
      const logged = s.weighIns.some((d) => d >= addDays(sunday, -1));
      if (logged) {
        out.resolve.push({ client_id: c.id, rule_key: "weigh_in_due", due_date: sunday });
        out.resolve.push({ client_id: c.id, rule_key: "weigh_in_overdue", due_date: addDays(sunday, 1) });
      } else {
        add("weigh_in_due", sunday, `Weigh-in due: ${c.name}`, "weigh_in");
        const monday = addDays(sunday, 1);
        if (today > monday || (today === monday && hourNow >= T.weighInOverdueHour)) add("weigh_in_overdue", monday, `Text ${c.name} for weigh-in`, "weigh_in");
      }
    }

    // --- Checkpoints / calibration -------------------------------------------
    for (const wk of plan.checkpoint_weeks) {
      const due = checkpointDate(plan, wk);
      if (s.checkpointsDone.includes(wk)) {
        out.resolve.push({ client_id: c.id, rule_key: `calibration_w${wk}`, due_date: due });
        continue;
      }
      if (inWindow(due, today, 21)) {
        const title = plan.goal_category === "weight_loss" || plan.goal_category === "muscle_gain" ? `${c.name}: week ${wk} — run calibration and decide calorie level` : `${c.name}: week ${wk} checkpoint review`;
        add(`calibration_w${wk}`, due, title, "checkpoint");
      }
    }

    // --- Retest reminders (day before) ----------------------------------------
    for (const wk of plan.retest_weeks) {
      const rd = retestDate(plan, wk);
      const reminder = addDays(rd, -1);
      if (reminder <= today && today <= rd) add(`retest_w${wk}`, reminder, `${c.name}: retest tomorrow (week ${wk} deload/retest)`, "retest");
    }

    // --- Progress rules --------------------------------------------------------
    const lastWeighIn = s.weighIns.length ? s.weighIns.reduce((a, b) => (a > b ? a : b)) : plan.start_date;
    const missingDue = addDays(lastWeighIn, T.weighInMissingDays);
    if (missingDue <= today) add("weigh_in_missing", missingDue, `Weigh-in missing for ${c.name} (${T.weighInMissingDays}+ days)`, "progress");

    if (s.adherence14 != null && s.adherence14 < T.adherenceLowPct && daysBetween(plan.start_date, today) >= 7) {
      add("adherence_low", mondayOnOrBefore(today), `Adherence check-in with ${c.name} (${Math.round(s.adherence14)}% over ${T.adherenceWindowDays} days)`, "progress");
    }
    if (s.offTrajectory.count >= 2 && s.offTrajectory.latestDate) add("review_plan", s.offTrajectory.latestDate, `Review plan for ${c.name}: off trajectory 2 weigh-ins in a row`, "progress");
    if (plan.goal_category === "weight_loss") {
      for (const d of s.strengthDrops) if (inWindow(d.date, today)) add(`strength_drop:${d.exercise}`, d.date, `${c.name}: ${d.exercise} below ${T.strengthRetentionPct}% of baseline — check protein, sleep, calories`, "progress");
    }
    if (s.energyLowDate && inWindow(s.energyLowDate, today)) add("energy_low", s.energyLowDate, `Energy follow-up with ${c.name} (below ${T.energyLow}/10 twice)`, "progress");
    // One celebration task per week listing the wins (PRs, benchmarks reached).
    const wins = s.celebrations.filter((cel) => inWindow(cel.date, today, 7));
    if (wins.length) {
      const latest = wins.reduce((a, w) => (w.date > a ? w.date : a), wins[0].date);
      const labels = Array.from(new Set(wins.map((w) => w.label)));
      const shown = labels.slice(0, 3).join("; ");
      add("celebrate", mondayOnOrBefore(latest), `Celebrate with ${c.name}: ${shown}${labels.length > 3 ? ` (+${labels.length - 3} more)` : ""}`, "celebrate");
    }
    const lastSession = s.lastSession ?? plan.start_date;
    const gapDue = addDays(lastSession, T.trainingGapDays);
    if (gapDue <= today) add("training_gap", gapDue, `Training check-in with ${c.name} (no sessions logged ${T.trainingGapDays}+ days)`, "progress");
  }

  // --- Plan end ------------------------------------------------------------------
  if (plan.status === "approved") {
    const renewal = addDays(end, -7);
    if (inWindow(renewal, today)) add("renewal", renewal, `Renewal conversation with ${c.name}`, "plan_end");
    if (inWindow(end, today)) add("final_weigh_in", end, `Week ${plan.weeks} final weigh-in for ${c.name}`, "plan_end");
  }
  return out;
}

export interface KeyDate {
  date: string;
  client_id: string;
  client_name: string;
  label: string;
}

/** Upcoming key dates (next `days` days) for the /today view and digest. */
export function upcomingKeyDates(s: ClientSnapshot, today: string, days = 7): KeyDate[] {
  const out: KeyDate[] = [];
  const plan = s.plan;
  if (!plan || plan.status !== "approved" || s.client.status !== "active") return out;
  const until = addDays(today, days);
  const push = (date: string, label: string) => {
    if (date >= today && date <= until) out.push({ date, client_id: s.client.id, client_name: s.client.name, label });
  };
  const end = planEndDate(plan);
  for (let d = sundayOnOrBefore(today); d <= until; d = addDays(d, 7)) if (d >= plan.start_date && d <= end) push(d, "Weigh-in");
  for (const wk of plan.checkpoint_weeks) push(checkpointDate(plan, wk), `Week ${wk} checkpoint`);
  for (const wk of plan.retest_weeks) push(retestDate(plan, wk), `Week ${wk} retest`);
  push(end, "Plan ends");
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
