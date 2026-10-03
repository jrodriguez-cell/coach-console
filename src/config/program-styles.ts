/**
 * Program styles (splits): session templates, rotations and which days per
 * week each one suits. This is the file to edit to change what a session
 * contains. Which style a client gets is decided in src/lib/program-design.ts.
 *
 * A slot is a movement pattern plus a role; the role sets its sets/reps/rest
 * (see prescribe() in src/lib/training.ts) and its priority when a session
 * has to be trimmed to fit the client's time. `muscle` narrows the candidate
 * exercises to ones that train that muscle.
 */
import type { Pattern } from "@/data/exercises";
import type { SlotRole } from "@/lib/plan-types";

export type Split =
  | "full_body"
  | "upper_lower"
  | "upper_lower_full"
  | "ppl"
  | "ul_ppl"
  | "body_part"
  | "strength"
  | "athletic";

export interface TemplateSlot {
  pattern: Pattern;
  role: SlotRole;
  muscle?: string;
}
export interface Template {
  key: string;
  name: string;
  slots: TemplateSlot[];
}

export interface ProgramStyle {
  label: string;
  /** one line for the trainer: who it suits */
  description: string;
  days: number[];
  templates: Template[];
  /** session keys in order, by days per week (cycled across the week and the plan) */
  rotation: Record<number, string[]>;
  /** keep isolation slots whatever the goal (body-part style splits) */
  keepIsolation?: boolean;
  /** power slots are already in the templates */
  hasPower?: boolean;
  /** only offered with this equipment (isolation-heavy splits need a gym) */
  needsGym?: boolean;
}

const S = (pattern: Pattern, role: SlotRole, muscle?: string): TemplateSlot => ({ pattern, role, muscle });

const FB_A: Template = { key: "A", name: "Full Body A", slots: [
  S("squat", "main"), S("horizontal_push", "main"), S("horizontal_pull", "secondary"),
  S("hinge", "secondary"), S("core_anti_extension", "core"), S("isolation_arms", "isolation", "biceps"),
] };
const FB_B: Template = { key: "B", name: "Full Body B", slots: [
  S("hinge", "main"), S("vertical_pull", "main"), S("vertical_push", "secondary"),
  S("lunge", "secondary"), S("core_anti_rotation", "core"), S("isolation_arms", "isolation", "triceps"),
] };
const FB_C: Template = { key: "C", name: "Full Body C", slots: [
  S("lunge", "main"), S("horizontal_pull", "main"), S("horizontal_push", "secondary"),
  S("squat", "accessory"), S("carry", "core"), S("isolation_shoulders", "isolation"),
] };

const UPPER_A: Template = { key: "UA", name: "Upper A", slots: [
  S("horizontal_push", "main"), S("horizontal_pull", "main"), S("vertical_push", "secondary"),
  S("vertical_pull", "secondary"), S("isolation_arms", "isolation", "biceps"), S("core_anti_rotation", "core"),
] };
const LOWER_A: Template = { key: "LA", name: "Lower A", slots: [
  S("squat", "main"), S("hinge", "secondary"), S("lunge", "accessory"),
  S("isolation_legs", "isolation", "hamstrings"), S("core_anti_extension", "core"),
] };
const UPPER_B: Template = { key: "UB", name: "Upper B", slots: [
  S("vertical_push", "main"), S("vertical_pull", "main"), S("horizontal_push", "secondary"),
  S("horizontal_pull", "secondary"), S("isolation_shoulders", "isolation"), S("isolation_arms", "isolation", "triceps"),
] };
const LOWER_B: Template = { key: "LB", name: "Lower B", slots: [
  S("hinge", "main"), S("squat", "secondary"), S("lunge", "accessory"),
  S("isolation_legs", "isolation", "calves"), S("carry", "core"),
] };

const PUSH: Template = { key: "PU", name: "Push", slots: [
  S("horizontal_push", "main"), S("vertical_push", "secondary"), S("isolation_chest", "isolation"),
  S("isolation_shoulders", "isolation"), S("isolation_arms", "isolation", "triceps"),
] };
const PULL: Template = { key: "PL", name: "Pull", slots: [
  S("vertical_pull", "main"), S("horizontal_pull", "secondary"), S("horizontal_pull", "accessory", "rear delts"),
  S("isolation_arms", "isolation", "biceps"), S("core_anti_rotation", "core"),
] };
const LEGS: Template = { key: "LG", name: "Legs", slots: [
  S("squat", "main"), S("hinge", "secondary"), S("lunge", "accessory"),
  S("isolation_legs", "isolation", "calves"), S("core_anti_extension", "core"),
] };

export const PROGRAM_STYLES: Record<Split, ProgramStyle> = {
  full_body: {
    label: "Full body",
    description: "Every session trains the whole body. Best for 2–3 days, beginners and busy schedules.",
    days: [2, 3, 4],
    templates: [FB_A, FB_B, FB_C],
    rotation: { 2: ["A", "B"], 3: ["A", "B", "C"], 4: ["A", "B", "C"] },
  },
  upper_lower: {
    label: "Upper / lower",
    description: "Alternates upper- and lower-body days; each area twice a week at 4 days.",
    days: [2, 3, 4, 5, 6],
    templates: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
    rotation: { 2: ["UA", "LA"], 3: ["UA", "LA", "UB", "LB"], 4: ["UA", "LA", "UB", "LB"], 5: ["UA", "LA", "UB", "LB"], 6: ["UA", "LA", "UB", "LB"] },
  },
  upper_lower_full: {
    label: "Upper / lower / full",
    description: "Three days: one upper, one lower, one full body. More volume per area than full body.",
    days: [3],
    templates: [
      { ...UPPER_A, key: "U", name: "Upper" },
      { ...LOWER_A, key: "L", name: "Lower" },
      { key: "F", name: "Full Body", slots: [
        S("hinge", "main"), S("vertical_pull", "main"), S("vertical_push", "secondary"),
        S("lunge", "secondary"), S("isolation_shoulders", "isolation"), S("core_anti_rotation", "core"),
      ] },
    ],
    rotation: { 3: ["U", "L", "F"] },
  },
  ppl: {
    label: "Push / pull / legs",
    description: "Sessions by movement: push, pull, legs. High volume per area; suits 6 days and experienced lifters.",
    days: [3, 5, 6],
    keepIsolation: true,
    templates: [
      PUSH, PULL, LEGS,
      { key: "UP", name: "Upper", slots: [
        S("vertical_push", "main"), S("horizontal_pull", "main"), S("horizontal_push", "secondary"),
        S("vertical_pull", "secondary"), S("isolation_arms", "isolation", "biceps"),
      ] },
      { key: "LO", name: "Lower", slots: [
        S("hinge", "main"), S("lunge", "secondary"), S("squat", "accessory"),
        S("isolation_legs", "isolation", "hamstrings"), S("carry", "core"),
      ] },
    ],
    rotation: { 3: ["PU", "PL", "LG"], 5: ["PU", "PL", "LG", "UP", "LO"], 6: ["PU", "PL", "LG", "PU", "PL", "LG"] },
  },
  ul_ppl: {
    label: "Upper / lower + push / pull / legs",
    description: "Five days: an upper and a lower strength day, then push, pull and legs for volume.",
    days: [5],
    keepIsolation: true,
    templates: [
      { ...UPPER_A, key: "U", name: "Upper" },
      { ...LOWER_A, key: "L", name: "Lower" },
      { ...PUSH, slots: [S("vertical_push", "main"), S("horizontal_push", "secondary"), S("isolation_chest", "isolation"), S("isolation_shoulders", "isolation"), S("isolation_arms", "isolation", "triceps")] },
      PULL,
      { ...LEGS, slots: [S("hinge", "main"), S("lunge", "secondary"), S("squat", "accessory"), S("isolation_legs", "isolation", "quads"), S("isolation_legs", "isolation", "calves")] },
    ],
    rotation: { 5: ["U", "L", "PU", "PL", "LG"] },
  },
  body_part: {
    label: "Body-part split",
    description: "One or two areas per day (chest, back, legs, shoulders, arms). For advanced muscle-gain clients training 5–6 days.",
    days: [5, 6],
    keepIsolation: true,
    needsGym: true,
    templates: [
      { key: "CH", name: "Chest", slots: [
        S("horizontal_push", "main"), S("horizontal_push", "secondary"), S("isolation_chest", "isolation"),
        S("vertical_push", "accessory"), S("isolation_arms", "isolation", "triceps"),
      ] },
      { key: "BK", name: "Back", slots: [
        S("vertical_pull", "main"), S("horizontal_pull", "secondary"), S("vertical_pull", "accessory"),
        S("horizontal_pull", "accessory", "rear delts"), S("core_flexion", "core"),
      ] },
      { key: "LG", name: "Legs", slots: [
        S("squat", "main"), S("hinge", "secondary"), S("lunge", "accessory"),
        S("isolation_legs", "isolation", "quads"), S("isolation_legs", "isolation", "hamstrings"), S("isolation_legs", "isolation", "calves"),
      ] },
      { key: "SH", name: "Shoulders", slots: [
        S("vertical_push", "main"), S("isolation_shoulders", "isolation", "side delts"), S("isolation_shoulders", "isolation", "rear delts"),
        S("horizontal_pull", "accessory", "rear delts"), S("carry", "core"),
      ] },
      { key: "AR", name: "Arms & core", slots: [
        S("vertical_pull", "secondary"), S("isolation_arms", "isolation", "biceps"), S("isolation_arms", "isolation", "triceps"),
        S("isolation_arms", "isolation", "biceps"), S("isolation_arms", "isolation", "triceps"), S("core_anti_rotation", "core"),
      ] },
    ],
    rotation: { 5: ["CH", "BK", "LG", "SH", "AR"], 6: ["CH", "BK", "LG", "SH", "AR", "LG"] },
  },
  strength: {
    label: "Strength focus",
    description: "Each day built around one big lift (squat, bench, deadlift, press). For intermediate+ clients who want to get stronger.",
    days: [3, 4],
    templates: [
      { key: "SQ", name: "Squat day", slots: [
        S("squat", "main"), S("horizontal_push", "secondary"), S("horizontal_pull", "accessory"),
        S("lunge", "accessory"), S("core_anti_extension", "core"),
      ] },
      { key: "BP", name: "Bench day", slots: [
        S("horizontal_push", "main"), S("horizontal_pull", "main"), S("vertical_push", "accessory"),
        S("isolation_arms", "isolation", "triceps"), S("core_anti_rotation", "core"),
      ] },
      { key: "DL", name: "Deadlift day", slots: [
        S("hinge", "main"), S("vertical_pull", "secondary"), S("squat", "accessory"),
        S("isolation_legs", "isolation", "hamstrings"), S("carry", "core"),
      ] },
      { key: "OH", name: "Press day", slots: [
        S("vertical_push", "main"), S("vertical_pull", "main"), S("horizontal_push", "accessory"),
        S("isolation_arms", "isolation", "biceps"), S("core_anti_extension", "core"),
      ] },
    ],
    rotation: { 3: ["SQ", "BP", "DL"], 4: ["SQ", "BP", "DL", "OH"] },
  },
  athletic: {
    label: "Athletic",
    description: "Power first, then strength, single-leg and trunk work. For sport and performance goals.",
    days: [2, 3, 4],
    hasPower: true,
    templates: [
      { key: "AL", name: "Lower power", slots: [
        S("power", "power", "glutes"), S("squat", "main"), S("hinge", "secondary"),
        S("lunge", "accessory", "adductors"), S("core_anti_rotation", "core"), S("carry", "core"),
      ] },
      { key: "AU", name: "Upper power", slots: [
        S("power", "power", "chest"), S("horizontal_push", "main"), S("vertical_pull", "main"),
        S("vertical_push", "secondary"), S("horizontal_pull", "secondary"), S("core_anti_extension", "core"),
      ] },
      { key: "AT", name: "Total body", slots: [
        S("power", "power"), S("hinge", "main"), S("lunge", "secondary"),
        S("horizontal_pull", "secondary"), S("vertical_push", "accessory"), S("core_anti_rotation", "core"),
      ] },
    ],
    rotation: { 2: ["AL", "AU"], 3: ["AL", "AU", "AT"], 4: ["AL", "AU", "AT", "AU"] },
  },
};

export const SPLITS = Object.keys(PROGRAM_STYLES) as Split[];
export const SPLIT_LABELS: Record<Split, string> = Object.fromEntries(SPLITS.map((s) => [s, PROGRAM_STYLES[s].label])) as Record<Split, string>;

export const splitFitsDays = (split: Split, days: number) => PROGRAM_STYLES[split].days.includes(days);

/** "3–4 days" style label of the days a split supports. */
export function splitDaysLabel(split: Split): string {
  const d = PROGRAM_STYLES[split].days;
  const contiguous = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  return d.length === 1 ? `${d[0]} days` : contiguous ? `${d[0]}–${d[d.length - 1]} days` : `${d.join(", ")} days`;
}

// ---------------------------------------------------------------------------
// Focus areas: extra work for an area the client wants to bring up.
// ---------------------------------------------------------------------------

export type Focus = "glutes" | "legs" | "back" | "chest" | "shoulders" | "arms" | "core";
export const FOCUS_AREAS: Focus[] = ["glutes", "legs", "back", "chest", "shoulders", "arms", "core"];
export const FOCUS_LABELS: Record<Focus, string> = { glutes: "Glutes", legs: "Legs", back: "Back & posture", chest: "Chest", shoulders: "Shoulders", arms: "Arms", core: "Core" };

/** Slots added for a focus, and which sessions get them (lower-body, upper-body or every session). */
export const FOCUS_SLOTS: Record<Focus, { region: "lower" | "upper" | "any"; slots: TemplateSlot[] }> = {
  glutes: { region: "lower", slots: [S("hinge", "accessory", "glutes")] },
  legs: { region: "lower", slots: [S("lunge", "accessory")] },
  back: { region: "upper", slots: [S("horizontal_pull", "accessory", "rear delts")] },
  chest: { region: "upper", slots: [S("isolation_chest", "isolation")] },
  shoulders: { region: "upper", slots: [S("isolation_shoulders", "isolation", "side delts")] },
  arms: { region: "upper", slots: [S("isolation_arms", "isolation", "biceps"), S("isolation_arms", "isolation", "triceps")] },
  core: { region: "any", slots: [S("core_anti_extension", "core")] },
};

/** Words in the client's goals and likes that suggest a focus (whole words, case-insensitive). */
export const FOCUS_KEYWORDS: Record<Focus, RegExp> = {
  glutes: /\b(glutes?|butt|booty|bum|hips?)\b/i,
  legs: /\b(legs|quads?|thighs?)\b/i,
  back: /\b(posture|upper back|lats|back (muscles|strength|width))\b/i,
  chest: /\b(chest|pecs?)\b/i,
  shoulders: /\b(shoulders|delts)\b/i,
  arms: /\b(arms|biceps?|triceps?|guns)\b/i,
  core: /\b(core|abs|six[- ]?pack)\b/i,
};

/** Words that suggest a strength-focused client. */
export const STRENGTH_KEYWORDS = /\b(strength|stronger|powerlift\w*|1rm|one rep max|max(es)? out|squat|bench|deadlift)\b/i;
