/** Plan calendar derived from the plan (dates from the start date). Pure. */
import { addDays, dayOfWeek, weekStart } from "./dates";
import { sessionsForWeek } from "./training";
import { cardioDaysForWeek } from "./schedule";
import { checkpointDate, retestDate } from "./tasks";
import { METS } from "@/config/energy";
import type { PlanParameters, TrainingPlan } from "./plan-types";

export interface CalendarDay {
  date: string;
  weekday: number;
  items: string[];
}

export interface CalendarWeek {
  week: number;
  phase: string | null;
  deload: boolean;
  days: CalendarDay[];
}

export function planCalendar(params: Pick<PlanParameters, "start_date" | "weeks" | "checkpoint_weeks">, training: TrainingPlan | null): CalendarWeek[] {
  const out: CalendarWeek[] = [];
  for (let w = 1; w <= params.weeks; w++) {
    const ws = weekStart(params.start_date, w);
    const wp = training?.weeks[w - 1];
    const lifts = training ? sessionsForWeek(training, w) : [];
    const cw = training?.cardio.weeks[w - 1];
    const cardioDays = training ? cardioDaysForWeek(training, w) : [];
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(ws, i);
      const wd = dayOfWeek(date);
      const items: string[] = [];
      const lift = lifts.find((l) => l.day === wd);
      if (lift) {
        const s = training!.sessions.find((x) => x.key === lift.key);
        items.push(`Strength: ${s?.name ?? lift.key}${wp?.deload ? " (deload)" : ""}`);
      }
      if (cw && cardioDays.includes(wd)) items.push(`Cardio: ${METS[training!.cardio.activity].label.toLowerCase()} ${cw.minutes} min${lift ? " (after lifting)" : ""}`);
      if (training && training.mobility.days.includes(wd) && training.mobility.sessions_per_week > 0) items.push(`Mobility/recovery ${training.mobility.minutes} min`);
      if (wd === 0) items.push("Weigh-in");
      if (training && wp?.retest && retestDate({ start_date: params.start_date, lifting_days: training.lifting_days }, w) === date) items.push("Retest");
      if (params.checkpoint_weeks.includes(w) && checkpointDate({ start_date: params.start_date }, w) === date) items.push(`Week ${w} checkpoint`);
      if (w === 1 && i === 0) items.unshift("Day 1: baseline weigh-in and measurements");
      days.push({ date, weekday: wd, items });
    }
    out.push({ week: w, phase: wp?.phase ?? null, deload: Boolean(wp?.deload), days });
  }
  return out;
}
