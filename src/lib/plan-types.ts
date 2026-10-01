/** Shapes of the JSON stored in plans.parameters / plans.training / plans.nutrition. */
import type { Phase } from "@/config/training-variables";
import type { GoalCategory } from "@/config/goal-templates";
import type { Pattern } from "@/data/exercises";
import type { NeatLevel, Activity } from "@/config/energy";
import type { EnergyOutputs } from "./energy";
import type { MacroTargets } from "./nutrition";
import type { GuardrailResult } from "./guardrails";

export interface LibExercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary_muscles: string[];
  equipment: string[];
  contraindications: string[];
  regression_id: string | null;
  progression_id: string | null;
  is_compound: boolean;
}

export interface LibFood {
  id: string;
  slug: string | null;
  name: string;
  category: "protein" | "carb" | "fat" | "vegetable" | "fruit" | "dairy" | "other";
  per_100g_cal: number;
  per_100g_protein: number;
  per_100g_carb: number;
  per_100g_fat: number;
  household_unit: string;
  household_g: number;
  allergens: string[];
  dietary_tags: string[];
}

export type SlotRole = "power" | "main" | "secondary" | "accessory" | "isolation" | "core";

export interface SlotDef {
  id: string;
  pattern: Pattern;
  role: SlotRole;
  /** lower = more important (kept first when trimming to session length) */
  priority: number;
  muscle?: string;
}

export interface ExerciseRef {
  id: string;
  name: string;
}

export interface SlotChoice extends SlotDef {
  exercise: ExerciseRef;
  regression: ExerciseRef | null;
  progression: ExerciseRef | null;
  note: string;
  unit: "reps" | "seconds";
}

export interface SessionPlan {
  key: string;
  name: string;
  slots: SlotChoice[];
}

export interface Prescription {
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  rpe_min: number;
  rpe_max: number;
}

export interface WeekPlan {
  week: number;
  phase: Phase;
  deload: boolean;
  retest: boolean;
  prescriptions: Record<string, Prescription>;
  /** estimated minutes per strength session, by session key */
  session_minutes: Record<string, number>;
}

export interface CardioWeek {
  week: number;
  sessions: number;
  minutes: number;
}

export interface CardioPlan {
  removed: boolean;
  removed_reason?: string;
  activity: Activity;
  met: number;
  zone: "zone2" | "zone3" | "any";
  hr_bpm: { min: number; max: number } | null;
  rpe: string;
  intensity: string;
  days: number[];
  weeks: CardioWeek[];
}

export interface MobilityPlan {
  sessions_per_week: number;
  minutes: number;
  days: number[];
  flow: ExerciseRef[];
}

export interface TrainingPlan {
  split: "full_body" | "upper_lower" | "ppl";
  split_label: string;
  lifting_days: number[];
  sessions: SessionPlan[];
  /** order sessions rotate through lifting days */
  rotation: string[];
  weeks: WeekPlan[];
  cardio: CardioPlan;
  mobility: MobilityPlan;
  coaching_notes: string[];
  program_summary: string;
  guidelines: string[];
  clearance_notes: string | null;
  selection_source: "llm" | "library_default";
}

export interface PlanParameters {
  start_date: string;
  weeks: number;
  days_per_week: number;
  session_length_min: number;
  phase_sequence: Phase[];
  calorie_mode: "deficit" | "fixed";
  deficit: number;
  target_override: number | null;
  bmr_method: "mifflin" | "katch";
  neat_level: NeatLevel;
  energy_mode: "formula" | "measured";
  reference_weight: "current" | "goal";
  protein_g_per_lb: number | null;
  fat_pct: number | null;
  checkpoint_weeks: number[];
  uncertainty_pct: number | null;
  /** week used for the energy model's exercise (1 at generation; checkpoint week after calibration) */
  energy_week: number;
  /** body weight (lb) used for the energy model; current weight at each recompute */
  weight_lb: number;
  /** weight at approval — anchors the planned trajectory */
  start_weight_lb?: number;
  /** planned lb/week at approval — anchors the planned trajectory */
  start_rate_lb_per_week?: number;
  start_band_half_width?: number;
}

export interface FoodPortion {
  food_id: string;
  name: string;
  grams: number;
  household: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ExampleMeal {
  name: string;
  items: FoodPortion[];
}

export interface ExampleDay {
  label: string;
  meals: ExampleMeal[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  within_band: { calories: boolean; protein_g: boolean; carbs_g: boolean; fat_g: boolean };
}

export interface SwapRow {
  category: string;
  basis: "protein" | "carbs" | "fat";
  options: { name: string; grams: number; household: string }[];
}

export interface NutritionPlan {
  blocked: boolean;
  blocked_reason: string | null;
  targets: MacroTargets | null;
  meals_per_day: number;
  meals_guidance: string;
  food_lists: Record<string, { id: string; name: string }[]>;
  example_days: ExampleDay[];
  swaps: SwapRow[];
  grocery_staples: string[];
  fiber_text: string;
  hydration_text: string;
  energy: EnergyOutputs | null;
  prediction_text: string;
  notes: string[];
  /** set when training was not generated because of a refer-out flag */
  training_blocked_reason?: string | null;
}

export interface GeneratedPlan {
  goal_category: GoalCategory;
  parameters: PlanParameters;
  training: TrainingPlan | null;
  training_blocked_reason: string | null;
  nutrition: NutritionPlan;
  energy: EnergyOutputs | null;
  guardrail_flags: GuardrailResult[];
}
