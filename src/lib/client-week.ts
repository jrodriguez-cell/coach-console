/**
 * Client-facing "this week's workouts" sheet: day-by-day sessions with
 * exercises, sets × reps, rest and effort, plus cardio and mobility.
 * Deliberately excludes energy/calorie numbers, guardrails, clearance notes
 * and trainer guidelines — the trainer sends it to the client themselves.
 */
import { METS } from "@/config/energy";
import { PHASES } from "@/config/training-variables";
import { planCalendar } from "./calendar";
import { addDays, DAY_NAMES, formatDate, planWeek, weekStart } from "./dates";
import { holdSeconds, sessionsForWeek } from "./training";
import type { PlanParameters, TrainingPlan } from "./plan-types";

export interface ClientWeekExercise {
  name: string;
  sets: number;
  /** per-set target, e.g. "8–12 reps" or "30–45 s" */
  target: string;
  unit: "reps" | "seconds";
  /** e.g. "3 × 8–12" or "2 × 30–45 s" */
  dose: string;
  rest: string;
  effort: string;
  easier: string | null;
  tip: string | null;
}

export interface ClientWeekDay {
  date: string;
  label: string; // "Mon, Oct 6"
  strength: { name: string; minutes: number; exercises: ClientWeekExercise[] } | null;
  cardio: string | null;
  mobility: { text: string; moves: string[] } | null;
  other: string[];
}

export interface ClientWeek {
  clientName: string;
  week: number;
  totalWeeks: number;
  range: string;
  phase: string;
  deload: boolean;
  draft: boolean;
  days: ClientWeekDay[];
}

/** Current plan week for today, clamped to the plan. */
export function currentPlanWeek(params: Pick<PlanParameters, "start_date" | "weeks">, today: string): number {
  return Math.min(Math.max(planWeek(params.start_date, today), 1), params.weeks);
}

const shortDate = (d: string) => formatDate(d).replace(/, \d{4}$/, "");
const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);

export function clientWeek(
  x: { clientName: string; draft: boolean; parameters: Pick<PlanParameters, "start_date" | "weeks" | "checkpoint_weeks">; training: TrainingPlan },
  weekIn: number,
): ClientWeek {
  const t = x.training;
  const week = Math.min(Math.max(Math.round(weekIn) || 1, 1), t.weeks.length);
  const wp = t.weeks[week - 1];
  const cal = planCalendar(x.parameters, t)[week - 1];
  const lifts = sessionsForWeek(t, week);
  const cw = t.cardio.weeks[week - 1];
  const start = weekStart(x.parameters.start_date, week);

  const days: ClientWeekDay[] = (cal?.days ?? []).map((d) => {
    const lift = lifts.find((l) => l.day === d.weekday);
    const s = lift ? t.sessions.find((ss) => ss.key === lift.key) : undefined;
    const exercises: ClientWeekExercise[] = [];
    for (const sl of s?.slots ?? []) {
      const rx = wp.prescriptions[sl.id];
      if (!rx) continue; // trimmed from this block
      const reps = sl.unit === "seconds" ? `${range(...holdSeconds(rx))} s` : range(rx.reps_min, rx.reps_max);
      exercises.push({
        name: sl.exercise.name,
        sets: rx.sets,
        target: sl.unit === "seconds" ? reps : `${reps} reps`,
        unit: sl.unit,
        dose: `${rx.sets} × ${reps}`,
        rest: `${rx.rest_sec}s`,
        effort: `${range(rx.rpe_min, rx.rpe_max)}/10`,
        easier: sl.regression?.name ?? null,
        tip: sl.note?.trim() || null,
      });
    }
    const cardioItem = d.items.find((i) => i.startsWith("Cardio:"));
    const mobilityItem = d.items.find((i) => i.startsWith("Mobility"));
    const hr = t.cardio.hr_bpm ? ` · heart rate ${t.cardio.hr_bpm.min}–${t.cardio.hr_bpm.max} bpm (effort ${t.cardio.rpe.replace(/^any \((.*)\)$/, "$1")}/10)` : "";
    return {
      date: d.date,
      label: `${DAY_NAMES[d.weekday]}, ${shortDate(d.date)}`,
      strength: s ? { name: s.name, minutes: wp.session_minutes[s.key] ?? 0, exercises } : null,
      cardio: cardioItem && cw ? `${METS[t.cardio.activity].label} · ${cw.minutes} min${hr}${lift ? " · after lifting" : ""}` : null,
      mobility: mobilityItem ? { text: `Mobility / recovery · ${t.mobility.minutes} min`, moves: t.mobility.flow.map((m) => m.name) } : null,
      other: d.items.filter((i) => i === "Weigh-in" || i === "Retest" || i.startsWith("Day 1")).map((i) => (i === "Weigh-in" ? "Weigh-in (morning, after the bathroom, before eating)" : i === "Retest" ? "Retest day — we'll check your progress on the main lifts" : "Day 1: baseline weigh-in and measurements")),
    };
  });

  return {
    clientName: x.clientName,
    week,
    totalWeeks: t.weeks.length,
    range: `${shortDate(start)} – ${shortDate(addDays(start, 6))}`,
    phase: PHASES[wp.phase].label,
    deload: wp.deload,
    draft: x.draft,
    days,
  };
}

export const EFFORT_NOTE = "Effort is out of 10: 10 = couldn't do one more rep. 7–8 means about 2–3 reps left in the tank.";

/** Most sets any exercise in the week asks for (sizes the log table). */
export function maxSets(w: ClientWeek): number {
  return Math.max(1, ...w.days.flatMap((d) => d.strength?.exercises.map((e) => e.sets) ?? []));
}


/**
 * Bold for plain-text messages. SMS/iMessage have no formatting, so headings
 * use Unicode sans-serif bold letters, which render bold in every messaging app.
 */
export function boldText(str: string): string {
  return Array.from(str)
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97);
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48);
      return ch;
    })
    .join("");
}

const restText = (r: string) => {
  const sec = parseInt(r, 10);
  return sec >= 60 && sec % 60 === 0 ? `${sec / 60} min` : `${sec}s`;
};

/** Short plain text for a text message: bold headings, one block per day. */
export function clientWeekText(w: ClientWeek): string {
  const L: string[] = [];
  L.push(boldText(`Week ${w.week} of ${w.totalWeeks}${w.draft ? " (DRAFT)" : ""}`));
  L.push(`${w.range} · ${w.phase}${w.deload ? " · deload (lighter week)" : ""}`);
  for (const d of w.days) {
    const parts = [d.strength?.name, d.cardio && "Cardio", d.mobility && "Mobility"].filter(Boolean);
    L.push("", boldText(`${d.label} · ${parts.length ? parts.join(" + ") : "Rest"}`));
    if (d.other.some((o) => o.startsWith("Weigh-in"))) L.push("Weigh-in this morning");
    if (d.strength) {
      L.push("Warm up 5–10 min");
      d.strength.exercises.forEach((e, i) => {
        L.push(`${i + 1}. ${e.name}`, `    ${e.sets} × ${e.target} · rest ${restText(e.rest)} · effort ${e.effort}`);
      });
    }
    if (d.cardio) L.push(`Cardio: ${d.cardio}`);
    if (d.mobility) L.push(`${d.mobility.text.replace("Mobility / recovery ·", "Mobility")}: ${d.mobility.moves.join(", ")}`);
  }
  L.push("", "Effort is out of 10 (10 = no reps left). Stop if anything causes sharp pain.");
  return L.join("\n");
}
