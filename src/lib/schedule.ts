/**
 * What the plan schedules on each date, what has been done, and workout
 * adherence computed from it. Pure; shared by the calendar, the weekly
 * checklist and the progress summary.
 */
import { addDays, daysBetween, dayOfWeek, weekStart } from "./dates";
import { sessionsForWeek } from "./training";
import { METS } from "@/config/energy";
import type { PlanParameters, TrainingPlan } from "./plan-types";

export type ItemKind = "strength" | "cardio" | "mobility";

/** planned_session_key used for check-offs that aren't strength sessions. */
export const CARDIO_KEY = "cardio";
export const MOBILITY_KEY = "mobility";

export interface PlannedItem {
  date: string;
  week: number;
  kind: ItemKind;
  /** strength session key, or "cardio" / "mobility" */
  key: string;
  label: string;
  minutes: number | null;
}

export interface SessionRecord {
  id?: string;
  date: string;
  planned_session_key: string | null;
  status: "completed" | "partial" | "missed" | "rest_swap";
  source?: string | null;
}

export const kindOfKey = (key: string | null): ItemKind => (key === CARDIO_KEY ? "cardio" : key === MOBILITY_KEY ? "mobility" : "strength");

/** Weekdays (0 = Sun) with cardio in a plan week, adding days after lifting days when sessions outgrow the listed days. */
export function cardioDaysForWeek(training: TrainingPlan, week: number): number[] {
  const cw = training.cardio.weeks[week - 1];
  if (training.cardio.removed || !cw || cw.sessions <= 0) return [];
  const days = training.cardio.days.slice(0, cw.sessions);
  for (const d of [...training.lifting_days, 0, 1, 2, 3, 4, 5, 6]) if (days.length < cw.sessions && !days.includes(d)) days.push(d);
  return days;
}

/** Workouts the plan schedules for one plan week. */
export function plannedItemsForWeek(params: Pick<PlanParameters, "start_date">, training: TrainingPlan, week: number): PlannedItem[] {
  if (week < 1 || week > training.weeks.length) return [];
  const ws = weekStart(params.start_date, week);
  const wp = training.weeks[week - 1];
  const lifts = sessionsForWeek(training, week);
  const cardio = cardioDaysForWeek(training, week);
  const cw = training.cardio.weeks[week - 1];
  const out: PlannedItem[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i);
    const wd = dayOfWeek(date);
    const lift = lifts.find((l) => l.day === wd);
    if (lift) {
      const s = training.sessions.find((x) => x.key === lift.key);
      out.push({ date, week, kind: "strength", key: lift.key, label: `${s?.name ?? lift.key}${wp?.deload ? " (deload)" : ""}`, minutes: wp?.session_minutes[lift.key] ?? null });
    }
    if (cw && cardio.includes(wd)) out.push({ date, week, kind: "cardio", key: CARDIO_KEY, label: `Cardio: ${METS[training.cardio.activity].label.toLowerCase()} ${cw.minutes} min`, minutes: cw.minutes });
    if (training.mobility.sessions_per_week > 0 && training.mobility.days.includes(wd)) out.push({ date, week, kind: "mobility", key: MOBILITY_KEY, label: `Mobility ${training.mobility.minutes} min`, minutes: training.mobility.minutes });
  }
  return out;
}

/** Plan week containing a date (may be outside 1..weeks). */
export const planWeekOf = (startDate: string, date: string) => Math.floor(daysBetween(startDate, date) / 7) + 1;

/** Workouts scheduled between two dates (inclusive). */
export function plannedItems(params: Pick<PlanParameters, "start_date" | "weeks">, training: TrainingPlan, from: string, to: string): PlannedItem[] {
  const out: PlannedItem[] = [];
  const first = Math.max(1, planWeekOf(params.start_date, from));
  const last = Math.min(params.weeks, planWeekOf(params.start_date, to));
  for (let w = first; w <= last; w++) out.push(...plannedItemsForWeek(params, training, w).filter((i) => i.date >= from && i.date <= to));
  return out;
}

/** The record that marks a planned item done: same date and key, completed or partial. */
export function recordFor(item: Pick<PlannedItem, "date" | "key">, records: SessionRecord[]): SessionRecord | undefined {
  return records.find((r) => r.date === item.date && r.planned_session_key === item.key && (r.status === "completed" || r.status === "partial"));
}

export interface WorkoutAdherence {
  /** strength + cardio items due so far in the window */
  due: number;
  done: number;
  pct: number | null;
  strength: { due: number; done: number };
  cardio: { due: number; done: number };
  mobility: { due: number; done: number };
}

/**
 * Workout adherence over a window: done ÷ due for strength sessions and
 * cardio (mobility is tracked but not counted). An item is due once its day
 * has passed; today's items count only once done. A workout done on another
 * day of the window still counts (clients move days around): completed
 * workouts of a kind are matched against that kind's due items, capped at
 * the number due. Partial = half. A rest-day swap excuses one item.
 * Cardio logged as minutes (check-ins) counts too: minutes ÷ the planned
 * session length, whichever gives more credit than the check-offs.
 */
export function workoutAdherence(items: PlannedItem[], records: SessionRecord[], from: string, today: string, opts: { cardioMinutesLogged?: number } = {}): WorkoutAdherence {
  const inWindow = records.filter((r) => r.date >= from && r.date <= today);
  const tally = (kind: ItemKind) => {
    const planned = items.filter((i) => i.kind === kind && i.date >= from && i.date <= today);
    const recs = inWindow.filter((r) => kindOfKey(r.planned_session_key) === kind);
    let credit = recs.reduce((a, r) => a + (r.status === "completed" ? 1 : r.status === "partial" ? 0.5 : 0), 0);
    if (kind === "cardio" && opts.cardioMinutesLogged) {
      const perSession = planned.find((i) => i.minutes)?.minutes ?? 0;
      if (perSession > 0) credit = Math.max(credit, opts.cardioMinutesLogged / perSession);
    }
    const excused = recs.filter((r) => r.status === "rest_swap").length;
    const past = planned.filter((i) => i.date < today).length;
    const todayDone = planned.filter((i) => i.date === today && recordFor(i, recs)).length;
    const due = Math.max(0, past + todayDone - excused);
    return { due, done: Math.min(due, credit) };
  };
  const strength = tally("strength");
  const cardio = tally("cardio");
  const mobility = tally("mobility");
  const due = strength.due + cardio.due;
  const done = strength.done + cardio.done;
  return { due, done, pct: due > 0 ? (done / due) * 100 : null, strength, cardio, mobility };
}

/** Readable name for a logged session's planned key. */
export function sessionLabel(key: string | null, training?: Pick<TrainingPlan, "sessions"> | null): string {
  if (key === CARDIO_KEY) return "Cardio";
  if (key === MOBILITY_KEY) return "Mobility";
  if (!key) return "Workout";
  return training?.sessions.find((s) => s.key === key)?.name ?? key;
}

export type ItemState = "checked" | "logged" | null;
export interface ChecklistItem extends PlannedItem {
  state: ItemState;
}
export interface ChecklistDay {
  date: string;
  items: ChecklistItem[];
}

/** One plan week as a day-by-day checklist with what's been done. */
export function weekChecklist(params: Pick<PlanParameters, "start_date">, training: TrainingPlan, week: number, records: SessionRecord[]): ChecklistDay[] {
  const items = plannedItemsForWeek(params, training, week);
  const ws = weekStart(params.start_date, week);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(ws, i);
    return {
      date,
      items: items.filter((it) => it.date === date).map((it) => {
        const r = recordFor(it, records);
        return { ...it, state: r ? (r.source === "checkoff" ? "checked" : "logged") : null };
      }),
    };
  });
}
