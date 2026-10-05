import { GOAL_TEMPLATES, type GoalCategory } from "@/config/goal-templates";
import type { Tone } from "@/components/ui";

export const goalLabel = (g: GoalCategory) => GOAL_TEMPLATES[g].label;

export const STATUS_TONE: Record<string, Tone> = { prospect: "blue", active: "green", paused: "gray", completed: "purple" };

export const EQUIPMENT_LABEL = { commercial_gym: "Commercial gym", home_basic: "Home (basic: dumbbells, bands, bench)", bodyweight: "Bodyweight only" } as const;
export const HISTORY_LABEL = { none: "None", beginner: "Beginner (< 6 months)", intermediate: "Intermediate (6 months – 2 years)", advanced: "Advanced (2+ years)" } as const;
export const COOKING_LABEL = { minimal: "Minimal", moderate: "Moderate", plenty: "Plenty" } as const;
export const PATTERN_LABEL: Record<string, string> = {
  squat: "Squat", hinge: "Hinge", lunge: "Lunge / single leg", horizontal_push: "Horizontal push", vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull", vertical_pull: "Vertical pull", core_anti_extension: "Core (anti-extension)",
  core_anti_rotation: "Core (anti-rotation)", core_flexion: "Core (flexion)", carry: "Carry", isolation_arms: "Arms",
  isolation_shoulders: "Shoulders", isolation_legs: "Legs (isolation)", isolation_chest: "Chest (isolation)", power: "Power", mobility: "Mobility", skill: "Skill",
};
