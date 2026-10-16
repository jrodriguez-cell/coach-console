/**
 * Coach notes: what the trainer learns about a client during training
 * (preferences, movement weaknesses, mobility limits, pain) and the program
 * change each kind makes. Edit the exercise lists here; slugs are in
 * src/data/exercises.ts. The first exercise the client can do is used.
 */
import type { Pattern } from "@/data/exercises";

export type NoteKind = "preference" | "weakness" | "mobility" | "pain" | "other";

export const NOTE_KINDS: { key: NoteKind; label: string; hint: string }[] = [
  { key: "preference", label: "Preference", hint: "An exercise they love or want to avoid" },
  { key: "weakness", label: "Movement weakness", hint: "e.g. weak hinge, knees cave on squats, can't brace" },
  { key: "mobility", label: "Mobility limitation", hint: "e.g. tight ankles, limited overhead reach" },
  { key: "pain", label: "Pain or injury", hint: "Exercises that load the area are swapped out" },
  { key: "other", label: "Other", hint: "Anything else worth remembering; shared with the AI on rebuilds" },
];

export type WeakMovement = "squat" | "hinge" | "single_leg" | "push" | "overhead" | "pull" | "core" | "grip";

/** Movement weaknesses: the patterns that show it, and corrective/accessory work to add (in order of preference). */
export const WEAKNESSES: Record<WeakMovement, { label: string; patterns: Pattern[]; work: string[] }> = {
  squat: { label: "Squat (depth, knees caving, balance)", patterns: ["squat"], work: ["tempo_bodyweight_squat", "box_squat_bw", "goblet_box_squat", "band_lateral_walk"] },
  hinge: { label: "Hip hinge (rounding, weak glutes/hamstrings)", patterns: ["hinge"], work: ["hip_hinge_drill", "glute_bridge", "back_extension", "single_leg_glute_bridge"] },
  single_leg: { label: "Single-leg stability", patterns: ["lunge"], work: ["supported_split_squat", "step_up_bw", "split_squat_bw", "single_leg_rdl_bw"] },
  push: { label: "Pressing / push-up strength", patterns: ["horizontal_push"], work: ["incline_push_up", "wall_push_up", "db_floor_press"] },
  overhead: { label: "Overhead pressing / shoulder stability", patterns: ["vertical_push"], work: ["wall_slide", "half_kneeling_db_press", "band_pull_apart"] },
  pull: { label: "Pulling / upper-back strength", patterns: ["horizontal_pull", "vertical_pull"], work: ["band_pull_apart", "face_pull", "band_row", "scap_pull_up"] },
  core: { label: "Core control / bracing", patterns: ["squat", "hinge", "core_anti_extension", "core_anti_rotation"], work: ["dead_bug", "bird_dog", "band_pallof_press", "incline_plank"] },
  grip: { label: "Grip", patterns: ["hinge", "vertical_pull", "horizontal_pull", "carry"], work: ["farmer_carry", "dead_hang", "suitcase_carry"] },
};

export type MobilityArea = "ankle" | "hip" | "hamstrings" | "t_spine" | "shoulder" | "wrist";

/** Mobility limits: sessions that need it (by pattern) and drills to add at the start of those sessions. */
export const MOBILITY: Record<MobilityArea, { label: string; patterns: Pattern[]; drills: string[] }> = {
  ankle: { label: "Ankles (squat depth, heels lifting)", patterns: ["squat", "lunge"], drills: ["ankle_rocks", "deep_squat_hold"] },
  hip: { label: "Hips (tight hip flexors, hip rotation)", patterns: ["squat", "hinge", "lunge"], drills: ["hip_90_90", "couch_stretch", "worlds_greatest_stretch"] },
  hamstrings: { label: "Hamstrings / posterior chain", patterns: ["hinge"], drills: ["supine_hamstring_stretch", "seated_pike_stretch"] },
  t_spine: { label: "Upper back (rounded posture, rotation)", patterns: ["horizontal_pull", "vertical_pull", "vertical_push"], drills: ["open_book", "thread_the_needle", "cat_cow"] },
  shoulder: { label: "Shoulders (overhead reach)", patterns: ["vertical_push", "vertical_pull"], drills: ["band_shoulder_pass", "wall_slide", "doorway_pec_stretch"] },
  wrist: { label: "Wrists (push-ups, front rack)", patterns: ["horizontal_push", "vertical_push"], drills: ["wrist_prep"] },
};
