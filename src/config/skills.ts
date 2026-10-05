/**
 * Skill goals: a specific movement the client wants to achieve (L-sit,
 * first pull-up, handstand…). When a client's goals name one, every session
 * opens with that skill's current step while the client is fresh, plus the
 * supporting work that builds it. The step moves up one rung each 4-week
 * block. Edit ladders and supporting work here; exercise slugs are in
 * src/data/exercises.ts.
 */
import type { Pattern } from "@/data/exercises";
import type { SlotRole } from "@/lib/plan-types";

export type SkillKey = "l_sit" | "pull_up" | "push_up" | "handstand" | "pistol_squat" | "toe_touch";

export interface SupportSlot {
  /** a specific exercise; falls back to `pattern` (+ muscle) if the client can't do it */
  slug?: string;
  pattern: Pattern;
  muscle?: string;
  role: SlotRole;
}

export interface SkillDef {
  label: string;
  /** easiest → hardest exercise slugs */
  ladder: string[];
  /** supporting work, shared out across the week's sessions */
  support: SupportSlot[];
  /** words in the client's goals that name the skill */
  keywords: RegExp;
  /** shown on the plan: when to move up a step */
  progressCue: string;
}

export const SKILLS: Record<SkillKey, SkillDef> = {
  l_sit: {
    label: "L-sit",
    ladder: ["support_hold", "tuck_l_sit", "one_leg_l_sit", "l_sit"],
    support: [
      { slug: "scap_depression", pattern: "skill", role: "accessory" },
      { slug: "seated_pike_leg_lift", pattern: "core_flexion", role: "core" },
      { slug: "seated_pike_stretch", pattern: "mobility", role: "accessory" },
      { slug: "hollow_body_hold", pattern: "core_anti_extension", role: "core" },
      { slug: "bench_dip", pattern: "isolation_arms", muscle: "triceps", role: "accessory" },
    ],
    keywords: /\bl[- ]?sits?\b/i,
    progressCue: "Move up a step when every set reaches the top of the hold time with straight arms and shoulders pushed down.",
  },
  pull_up: {
    label: "Pull-up",
    ladder: ["dead_hang", "scap_pull_up", "band_assisted_pull_up", "negative_pull_up", "pull_up"],
    support: [
      { pattern: "horizontal_pull", role: "accessory" },
      { pattern: "vertical_pull", role: "accessory" },
      { slug: "hollow_body_hold", pattern: "core_anti_extension", role: "core" },
      { pattern: "isolation_arms", muscle: "biceps", role: "accessory" },
    ],
    keywords: /\b(pull[- ]?ups?|chin[- ]?ups?)\b/i,
    progressCue: "Move up a step when all sets hit the top of the range with full range of motion and no kipping.",
  },
  push_up: {
    label: "Push-up",
    ladder: ["wall_push_up", "incline_push_up", "push_up", "decline_push_up"],
    support: [
      { slug: "forearm_plank", pattern: "core_anti_extension", role: "core" },
      { pattern: "isolation_arms", muscle: "triceps", role: "accessory" },
      { pattern: "horizontal_push", role: "accessory" },
    ],
    keywords: /\bpush[- ]?ups?\b/i,
    progressCue: "Move up a step when all sets hit the top of the rep range with a straight body line.",
  },
  handstand: {
    label: "Handstand",
    ladder: ["box_pike_hold", "chest_to_wall_handstand", "handstand_practice"],
    support: [
      { slug: "wrist_prep", pattern: "mobility", role: "accessory" },
      { pattern: "vertical_push", role: "accessory" },
      { slug: "hollow_body_hold", pattern: "core_anti_extension", role: "core" },
    ],
    keywords: /\bhand[- ]?stands?\b/i,
    progressCue: "Move up a step when every hold reaches the top of the time with stacked hips and locked arms.",
  },
  pistol_squat: {
    label: "Pistol squat",
    ladder: ["single_leg_box_squat", "assisted_pistol_squat", "pistol_squat"],
    support: [
      { slug: "ankle_rocks", pattern: "mobility", role: "accessory" },
      { pattern: "lunge", role: "accessory" },
      { slug: "single_leg_glute_bridge", pattern: "hinge", role: "accessory" },
    ],
    keywords: /\bpistol( squats?)?s?\b/i,
    progressCue: "Move up a step when all reps are controlled to the bottom with the heel down.",
  },
  toe_touch: {
    label: "Toe touch",
    ladder: ["supine_hamstring_stretch", "standing_forward_fold", "seated_pike_stretch"],
    support: [
      { slug: "hip_hinge_drill", pattern: "hinge", role: "accessory" },
      { slug: "seated_pike_leg_lift", pattern: "core_flexion", role: "core" },
      { pattern: "hinge", muscle: "hamstrings", role: "accessory" },
    ],
    keywords: /\b(touch (my |her |his |their )?toes|toe[- ]?touch(es)?|forward fold)\b/i,
    progressCue: "Move up a step when the client reaches further each week without pain.",
  },
};

export const SKILL_KEYS = Object.keys(SKILLS) as SkillKey[];

/** The skill a client's own goal words name, if any (first match in this order). */
export function detectSkill(goalText: string): SkillKey | null {
  const order: SkillKey[] = ["l_sit", "handstand", "pistol_squat", "pull_up", "push_up", "toe_touch"];
  return order.find((k) => SKILLS[k].keywords.test(goalText)) ?? null;
}

/** Ladder step to start on: newer trainees at the bottom. */
export function startStep(level: "none" | "beginner" | "intermediate" | "advanced", ladderLength: number): number {
  const s = level === "advanced" ? 2 : level === "intermediate" ? 1 : 0;
  return Math.min(s, ladderLength - 1);
}
