/**
 * The four goal templates (ISSA CPT programming guidelines). Used by the
 * generator and printed on the plan.
 */
import type { Activity } from "./energy";

export type GoalCategory = "general_health" | "muscle_gain" | "weight_loss" | "performance";

export const GOAL_CATEGORIES: GoalCategory[] = ["general_health", "muscle_gain", "weight_loss", "performance"];

export interface CardioRule {
  /** sessions per week */
  freqMin: number;
  freqMax: number;
  /** minutes per session */
  minMin: number;
  minMax: number;
  /** optional weekly-minutes goal to build toward */
  weeklyTargetMin?: number;
  intensity: string;
  defaultActivity: Activity;
  /** activity used for deconditioned clients */
  deconditionedActivity: Activity;
  zone: "zone2" | "zone3" | "any";
}

export interface GoalTemplate {
  key: GoalCategory;
  label: string;
  guidelines: [string, string, string, string, string];
  cardio: CardioRule;
  includesIsolation: boolean;
  includesPower: boolean;
  shortRestOk: boolean;
}

export const GOAL_TEMPLATES: Record<GoalCategory, GoalTemplate> = {
  general_health: {
    key: "general_health",
    label: "General health",
    guidelines: [
      "Educate on sleep, stress management and mobility.",
      "Build daily activity and consistency with activities the client enjoys.",
      "Provide balanced-nutrition guidance.",
      "Match assessments to the client's concerns.",
      "Build up to both resistance and cardiorespiratory training.",
    ],
    cardio: { freqMin: 3, freqMax: 7, minMin: 20, minMax: 60, weeklyTargetMin: 150, intensity: "Any intensity, client-preferred activities", defaultActivity: "walking_brisk", deconditionedActivity: "walking", zone: "any" },
    includesIsolation: false,
    includesPower: false,
    shortRestOk: false,
  },
  muscle_gain: {
    key: "muscle_gain",
    label: "Muscle gain",
    guidelines: [
      "Prioritize training volume.",
      "Use compound AND isolation exercises.",
      "Eat in a 200–500 kcal/day surplus.",
      "Keep macronutrients within appropriate ranges.",
      "Use recovery techniques (sleep, deloads, mobility).",
    ],
    cardio: { freqMin: 2, freqMax: 3, minMin: 20, minMax: 30, intensity: "Any intensity, 20–30 min max", defaultActivity: "cycling_moderate", deconditionedActivity: "walking_brisk", zone: "any" },
    includesIsolation: true,
    includesPower: false,
    shortRestOk: false,
  },
  weight_loss: {
    key: "weight_loss",
    label: "Weight loss",
    guidelines: [
      "Increase daily calorie burn (activity and training).",
      "Emphasize compound movements.",
      "Eat in a 200–500 kcal/day deficit.",
      "Address sleep, stress, hydration and recovery.",
      "Aim for 1–2 lb/week of loss.",
    ],
    cardio: { freqMin: 3, freqMax: 6, minMin: 30, minMax: 90, intensity: "Any intensity (higher intensity = shorter sessions)", defaultActivity: "walking_brisk", deconditionedActivity: "walking", zone: "zone2" },
    includesIsolation: false,
    includesPower: false,
    shortRestOk: true,
  },
  performance: {
    key: "performance",
    label: "Performance",
    guidelines: [
      "Periodize around the client's sport or event (off/pre/in/post-season).",
      "Include skill- and sport-specific movement learning.",
      "Estimate calorie and hydration needs; favor carbohydrate and protein.",
      "Train speed, agility and endurance specific to the sport.",
      "Schedule periodic tests to track performance.",
    ],
    cardio: { freqMin: 3, freqMax: 5, minMin: 15, minMax: 30, intensity: "High/maximum intensity, aligned with the sport", defaultActivity: "running", deconditionedActivity: "jogging", zone: "zone3" },
    includesIsolation: false,
    includesPower: true,
    shortRestOk: false,
  },
};

/** Heart-rate zones per the textbook. */
export const HR_ZONES = {
  zone2: { label: "Zone 2", pctMin: 0.7, pctMax: 0.8, rpe: "5–6" },
  zone3: { label: "Zone 3", pctMin: 0.8, pctMax: 0.9, rpe: "7–8" },
} as const;

/** Age-predicted max HR (220 − age). Estimate; clearance ceilings override. */
export function hrMax(age: number): number {
  return 220 - age;
}

/** Preset benchmark sets by goal (editable per client). */
export const PRESET_BENCHMARKS: Record<GoalCategory, { name: string; category: "body" | "strength" | "cardio" | "skill" | "mobility" | "sport" | "habit"; unit: string; direction: "higher_better" | "lower_better" }[]> = {
  general_health: [
    { name: "Resting heart rate", category: "cardio", unit: "bpm", direction: "lower_better" },
    { name: "Weekly active minutes", category: "habit", unit: "min", direction: "higher_better" },
    { name: "Average sleep", category: "habit", unit: "hrs", direction: "higher_better" },
    { name: "Average energy", category: "habit", unit: "1-10", direction: "higher_better" },
    { name: "Mobility screen score", category: "mobility", unit: "pts", direction: "higher_better" },
  ],
  muscle_gain: [
    { name: "Body weight", category: "body", unit: "lb", direction: "higher_better" },
    { name: "Arm circumference", category: "body", unit: "in", direction: "higher_better" },
    { name: "Squat e1RM", category: "strength", unit: "lb", direction: "higher_better" },
    { name: "Bench press e1RM", category: "strength", unit: "lb", direction: "higher_better" },
  ],
  weight_loss: [
    { name: "Body weight", category: "body", unit: "lb", direction: "lower_better" },
    { name: "Waist", category: "body", unit: "in", direction: "lower_better" },
    { name: "Strength retention (main lift 5RM)", category: "strength", unit: "lb", direction: "higher_better" },
    { name: "Weekly adherence", category: "habit", unit: "%", direction: "higher_better" },
  ],
  performance: [
    { name: "5K time", category: "sport", unit: "min", direction: "lower_better" },
    { name: "Vertical jump", category: "sport", unit: "in", direction: "higher_better" },
    { name: "Squat 1RM", category: "strength", unit: "lb", direction: "higher_better" },
  ],
};
