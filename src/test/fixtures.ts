import { EXERCISES } from "@/data/exercises";
import { FOODS } from "@/data/foods";
import { IntakeAnswersSchema, type IntakeAnswers } from "@/lib/intake";
import type { LibExercise, LibFood } from "@/lib/plan-types";

export const EX_LIB: LibExercise[] = EXERCISES.map((e) => ({
  id: e.slug, slug: e.slug, name: e.name, pattern: e.pattern, primary_muscles: e.primary_muscles, equipment: e.equipment,
  contraindications: e.contraindications, regression_id: e.regression, progression_id: e.progression, is_compound: e.is_compound,
}));
export const FOOD_LIB: LibFood[] = FOODS.map((f) => ({ ...f, id: f.slug, slug: f.slug }));

/** Weight-loss sample client (the CMR-style 270 lb client). */
export const WL_INTAKE: IntakeAnswers = IntakeAnswersSchema.parse({
  age: 36, sex: "male", height_in: 75, weight_lb: 270, body_fat_pct: 31.5, goal_weight_lb: 230,
  primary_goal: "Lose fat and feel better", success_90_days: "Down 20 lb and off the couch", training_days_per_week: 4,
  session_length_min: 60, equipment: "commercial_gym", training_history: "beginner", activity_level: "sedentary",
  current_exercise: [{ type: "walking", sessions_per_week: 2, minutes: 20 }], current_exercise_confirmed: true,
  dietary_pattern: "omnivore", allergies: [], foods_excluded: ["tuna"], meals_per_day: 3,
});

/** Performance sample client (a recreational 10K runner). */
export const PERF_INTAKE: IntakeAnswers = IntakeAnswersSchema.parse({
  age: 28, sex: "female", height_in: 66, weight_lb: 140, primary_goal: "Run a faster 10K", sport_activity: "Road running (10K)",
  training_days_per_week: 3, session_length_min: 50, equipment: "home_basic", training_history: "intermediate",
  activity_level: "on_feet_part", current_exercise: [{ type: "running", sessions_per_week: 3, minutes: 35 }], current_exercise_confirmed: true,
  dietary_pattern: "vegetarian", allergies: ["peanut"], meals_per_day: 4, injury_areas: ["ankle"],
});
