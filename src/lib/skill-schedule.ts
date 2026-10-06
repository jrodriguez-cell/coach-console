/** Which skill-ladder step each part of a plan practises (for the plan page and PDF). Pure. */
import { SKILLS } from "@/config/skills";
import { EXERCISES } from "@/data/exercises";
import { sessionsInBlock } from "./training";
import type { TrainingPlan } from "./plan-types";

export interface SkillStep {
  step: number;
  name: string;
  /** e.g. "1–4", or null when this plan doesn't reach the step */
  weeks: string | null;
}

export function skillSchedule(t: Pick<TrainingPlan, "skill" | "sessions" | "weeks">): SkillStep[] {
  if (!t.skill) return [];
  const names = SKILLS[t.skill].ladder.map((slug) => EXERCISES.find((e) => e.slug === slug)?.name ?? slug);
  const ranges = new Map<number, [number, number]>();
  for (let b = 0; b < Math.ceil(t.weeks.length / 4); b++) {
    const step = sessionsInBlock(t.sessions, b).flatMap((ss) => ss.slots).find((sl) => sl.role === "skill");
    const idx = step ? names.indexOf(step.exercise.name) : -1;
    if (idx < 0) continue;
    const from = b * 4 + 1, to = Math.min(t.weeks.length, b * 4 + 4);
    const prev = ranges.get(idx);
    ranges.set(idx, [prev ? prev[0] : from, to]);
  }
  return names.map((name, i) => {
    const r = ranges.get(i);
    return { step: i + 1, name, weeks: r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : null };
  });
}
