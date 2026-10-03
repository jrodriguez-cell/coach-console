/**
 * Chooses the program style (split) and focus areas from the client's
 * inputs. Deterministic and explainable: every choice comes with the reasons
 * shown to the trainer, and the trainer can override both on the plan.
 * Templates live in src/config/program-styles.ts.
 */
import type { GoalCategory } from "@/config/goal-templates";
import {
  FOCUS_AREAS, FOCUS_KEYWORDS, PROGRAM_STYLES, splitDaysLabel, splitFitsDays, STRENGTH_KEYWORDS,
  type Focus, type Split,
} from "@/config/program-styles";
import type { EquipmentAccess } from "@/data/exercises";
import type { TrainingLevel } from "./training";

export interface ProgramInput {
  goal: GoalCategory;
  daysPerWeek: number;
  level: TrainingLevel;
  deconditioned: boolean;
  age: number;
  sessionLengthMin: number;
  equipment?: EquipmentAccess;
  /** client's own words: primary goal, 90-day success, sport, likes */
  text: string;
  /** trainer's choice; null/undefined = automatic */
  override?: Split | null;
}

export interface ProgramChoice {
  split: Split;
  reasons: string[];
  /** set when the trainer's choice didn't fit the days per week */
  overrideIgnored?: string;
}

const experienced = (l: TrainingLevel) => l === "intermediate" || l === "advanced";

export function chooseProgram(p: ProgramInput): ProgramChoice {
  const days = p.daysPerWeek;
  let overrideIgnored: string | undefined;
  if (p.override) {
    const style = PROGRAM_STYLES[p.override];
    if (!splitFitsDays(p.override, days)) overrideIgnored = `${style.label} needs ${splitDaysLabel(p.override)} a week, not ${days}; picked automatically instead.`;
    else if (style.needsGym && p.equipment && p.equipment !== "commercial_gym") overrideIgnored = `${style.label} needs gym equipment; picked automatically instead.`;
    else return { split: p.override, reasons: ["Chosen by you."] };
  }
  const auto = autoSplit(p);
  return overrideIgnored ? { ...auto, overrideIgnored } : auto;
}

function autoSplit(p: ProgramInput): ProgramChoice {
  const days = p.daysPerWeek;
  const r = (split: Split, ...reasons: string[]): ProgramChoice => ({ split, reasons });

  if (p.deconditioned || p.level === "none") {
    return days <= 4
      ? r("full_body", "New to training or deconditioned: practising every movement pattern each session builds skill fastest.")
      : r("upper_lower", "New to training or deconditioned, with 5+ days: upper/lower keeps each session short and lets areas recover.");
  }

  if (p.goal === "performance") {
    return days <= 4
      ? r("athletic", "Performance goal: power work first while fresh, then strength, single-leg and trunk work.")
      : r("upper_lower", "Performance goal with 5+ days: upper/lower with power work at the start of each session.");
  }

  if (experienced(p.level) && (days === 3 || days === 4) && STRENGTH_KEYWORDS.test(p.text)) {
    return r("strength", "Their goals mention strength or the big lifts, and they have the experience for it: each day is built around one main lift.");
  }

  const older = p.age >= 60;
  const short = p.sessionLengthMin <= 40;

  if (p.goal === "muscle_gain") {
    if (days <= 2) return r("full_body", "Two days: full body trains each muscle twice a week.");
    if (days === 3) {
      return p.level === "beginner" || short
        ? r("full_body", p.level === "beginner" ? "Beginner building muscle on 3 days: full body gives each muscle three exposures a week." : "Short sessions: full body spreads the volume over all three days.")
        : r("upper_lower_full", "Muscle gain on 3 days with some experience: an upper, a lower and a full-body day add volume per area.");
    }
    if (days === 4) return r("upper_lower", "Four days: upper/lower trains each muscle twice a week with room for isolation work.");
    if (older) return r("upper_lower", "Age 60+: upper/lower keeps weekly volume moderate and spreads the load.");
    if (days === 5) {
      return p.level === "advanced" && (!p.equipment || p.equipment === "commercial_gym")
        ? r("body_part", "Advanced and building muscle on 5 days: a body-part split allows the most volume per area.")
        : r("ul_ppl", "Muscle gain on 5 days: two strength-focused days plus push/pull/legs for volume.");
    }
    return p.level === "beginner"
      ? r("upper_lower", "Beginner on 6 days: upper/lower keeps sessions simpler than a push/pull/legs split.")
      : r("ppl", "Six days with experience: push/pull/legs twice through the week.");
  }

  // Weight loss and general health: compound-led, balanced sessions.
  const why = p.goal === "weight_loss" ? "Weight loss: compound lifts across the whole body burn the most and keep strength" : "General health: balanced sessions that cover every movement pattern";
  if (days <= 3) return r("full_body", `${why}; full body fits ${days} days.`);
  if (days === 4 && short && !older) return r("upper_lower", `${why}; with short sessions, upper/lower keeps each one quick.`);
  if (days === 4) return r("upper_lower", `${why}; upper/lower gives each area two sessions a week.`);
  return r("upper_lower", `${why}; with ${days} days, upper/lower rotates so each area gets 2–3 sessions without long days.`);
}

/** Focus areas suggested by the client's own words (at most two). */
export function suggestFocus(text: string): Focus[] {
  return FOCUS_AREAS.filter((f) => FOCUS_KEYWORDS[f].test(text)).slice(0, 2);
}

/** Phase order nudged by the program style (only when the trainer hasn't set phases). */
export function phaseHint(split: Split, level: TrainingLevel): "strength" | "power" | null {
  if (split === "strength" && experienced(level)) return "strength";
  return null;
}
