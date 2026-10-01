/**
 * Intake schema, PAR-Q and refer-out screening. Pure; unit-tested.
 */
import { z } from "zod";
import { CONTRAINDICATION_TAGS } from "@/data/exercises";
import { DIETARY_PATTERNS } from "@/data/foods";

export const PARQ_QUESTIONS = [
  "Has your doctor ever said that you have a heart condition OR high blood pressure?",
  "Do you feel pain in your chest at rest, during your daily activities of living, OR when you do physical activity?",
  "Do you lose balance because of dizziness OR have you lost consciousness in the last 12 months?",
  "Have you ever been diagnosed with another chronic medical condition (other than heart disease or high blood pressure)?",
  "Are you currently taking prescribed medications for a chronic medical condition?",
  "Do you currently have (or have had within the past 12 months) a bone, joint, or soft-tissue problem that could be made worse by becoming more physically active?",
  "Has your doctor ever said that you should only do medically supervised physical activity?",
] as const;

export const REFER_OUT_FLAGS = {
  injury: { label: "Injury or pain", blocks: null, hint: "Refer to physician / physical therapist for assessment." },
  acute_injury: { label: "Acute injury", blocks: "training", hint: "Training generation is blocked until clearance or referral is recorded." },
  medical_condition: { label: "Medical condition affecting diet or exercise", blocks: "nutrition", hint: "Refer to physician / registered dietitian. Nutrition generation is blocked until handled." },
  eating_disorder: { label: "Eating-disorder history or concern", blocks: "nutrition", hint: "Refer to physician / registered dietitian / mental-health professional. Nutrition generation is blocked until handled." },
  mental_health: { label: "Mental-health concern", blocks: null, hint: "Refer to a licensed mental-health professional. Do not advise on it." },
} as const;
export type ReferOutFlag = keyof typeof REFER_OUT_FLAGS;
export const REFER_OUT_KEYS = Object.keys(REFER_OUT_FLAGS) as ReferOutFlag[];

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);
const optNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().min(min).max(max).nullable());

export const BaselineExerciseSchema = z.object({
  type: z.enum(["strength", "walking", "jogging", "running", "cycling", "mobility", "yoga", "sport"]),
  sessions_per_week: num(0, 14),
  minutes: num(0, 300),
});

export const IntakeAnswersSchema = z.object({
  // Status
  age: num(14, 100),
  sex: z.enum(["male", "female"]),
  height_in: num(48, 90),
  weight_lb: num(70, 700),
  body_fat_pct: optNum(3, 70),
  goal_weight_lb: optNum(70, 700),
  // Purpose / goals
  primary_goal: z.string().max(500).default(""),
  success_90_days: z.string().max(1000).default(""),
  timeline_event: z.string().max(500).default(""),
  event_date: z.string().nullable().default(null),
  sport_activity: z.string().max(300).default(""),
  // Schedule / equipment
  training_days_per_week: num(2, 6),
  session_length_min: num(20, 120),
  preferred_days: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  equipment: z.enum(["commercial_gym", "home_basic", "bodyweight"]),
  // History
  training_history: z.enum(["none", "beginner", "intermediate", "advanced"]),
  deconditioned: z.boolean().default(false),
  current_exercise: z.array(BaselineExerciseSchema).default([]),
  current_exercise_confirmed: z.boolean().default(false),
  wearable_active_kcal_per_day: optNum(0, 3000),
  injuries_text: z.string().max(2000).default(""),
  injury_areas: z.array(z.enum(CONTRAINDICATION_TAGS)).default([]),
  activity_level: z.enum(["sedentary", "on_feet_part", "on_feet_most", "physical_job"]),
  measured_tdee: optNum(800, 8000),
  measured_tdee_days: optNum(1, 365),
  // Preferences
  exercise_likes: z.string().max(1000).default(""),
  exercise_dislikes: z.array(z.string().max(80)).default([]),
  cardio_preferences: z.string().max(500).default(""),
  // Nutrition preferences
  dietary_pattern: z.enum(DIETARY_PATTERNS).default("omnivore"),
  allergies: z.array(z.string()).default([]),
  foods_excluded: z.array(z.string().max(80)).default([]),
  meals_per_day: num(2, 6).default(3),
  cooking_time: z.enum(["minimal", "moderate", "plenty"]).default("moderate"),
  supplements: z.string().max(500).default(""),
});
export type IntakeAnswers = z.infer<typeof IntakeAnswersSchema>;

export const ParqSchema = z.array(z.boolean()).length(PARQ_QUESTIONS.length);

export const ReferOutSchema = z.object({
  injury: z.boolean().default(false),
  acute_injury: z.boolean().default(false),
  medical_condition: z.boolean().default(false),
  eating_disorder: z.boolean().default(false),
  mental_health: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
});
export type ReferOutFlags = z.infer<typeof ReferOutSchema>;

export function parqFlagged(answers: boolean[]): boolean {
  return answers.some(Boolean);
}

export function activeReferOutFlags(flags: Partial<ReferOutFlags> | null | undefined): ReferOutFlag[] {
  if (!flags) return [];
  return REFER_OUT_KEYS.filter((k) => Boolean(flags[k]));
}

export interface ReferralHandling {
  flag: ReferOutFlag;
  handled_note: string;
}

/** Which plan sections are blocked by unhandled refer-out flags. */
export function blockedSections(flags: Partial<ReferOutFlags> | null | undefined, handled: ReferralHandling[]): { training: ReferOutFlag[]; nutrition: ReferOutFlag[] } {
  const out = { training: [] as ReferOutFlag[], nutrition: [] as ReferOutFlag[] };
  for (const f of activeReferOutFlags(flags)) {
    const blocks = REFER_OUT_FLAGS[f].blocks;
    if (!blocks) continue;
    if (handled.some((h) => h.flag === f && h.handled_note.trim().length > 0)) continue;
    out[blocks].push(f);
  }
  return out;
}

export type ClearanceStatus = "pending" | "received" | "not_required";

export interface ClearanceLike {
  status: ClearanceStatus;
  notes?: string | null;
  reason?: string | null;
}

/**
 * PAR-Q approval gate: if any PAR-Q answer is yes, approval requires a
 * clearance record that is "received" (with notes) or "not_required" (with a reason).
 */
export function clearanceIssue(parqIsFlagged: boolean, c: ClearanceLike | null | undefined): string | null {
  if (!parqIsFlagged) return null;
  if (!c) return "PAR-Q flagged: record physician clearance status before approving.";
  if (c.status === "pending") return "Physician clearance is pending.";
  if (c.status === "received" && !(c.notes ?? "").trim()) return "Clearance received: add clearance notes (limits, HR/RPE ceiling, activities to avoid).";
  if (c.status === "not_required" && !(c.reason ?? "").trim()) return "Clearance marked not required: record the reason.";
  return null;
}

/** Deconditioned heuristic unless the trainer set it explicitly. */
export function isDeconditioned(a: Pick<IntakeAnswers, "deconditioned" | "training_history" | "activity_level">): boolean {
  if (a.deconditioned) return true;
  return a.training_history === "none" || (a.training_history === "beginner" && a.activity_level === "sedentary");
}
