/**
 * Deterministic training skeleton: split, phases, sets/reps/rest, schedule,
 * cardio and mobility. The LLM only chooses exercises from the candidate
 * lists built here and writes notes; every number comes from this module.
 */
import { DELOAD, PHASES, WARMUP_MIN, type Phase } from "@/config/training-variables";
import { GOAL_TEMPLATES, HR_ZONES, hrMax, type GoalCategory } from "@/config/goal-templates";
import { METS } from "@/config/energy";
import { EQUIPMENT_ACCESS, type EquipmentAccess, type Pattern } from "@/data/exercises";
import type { ExerciseLoad } from "./energy";
import type {
  CardioPlan,
  CardioWeek,
  ExerciseRef,
  LibExercise,
  MobilityPlan,
  Prescription,
  SessionPlan,
  SlotChoice,
  SlotDef,
  SlotRole,
  TrainingPlan,
  WeekPlan,
} from "./plan-types";

// ---------------------------------------------------------------------------
// Split selection
// ---------------------------------------------------------------------------

export type Split = TrainingPlan["split"];

export function chooseSplit(daysPerWeek: number): Split {
  if (daysPerWeek <= 3) return "full_body";
  if (daysPerWeek === 4) return "upper_lower";
  return "ppl";
}

export const SPLIT_LABELS: Record<Split, string> = {
  full_body: "Full body",
  upper_lower: "Upper / lower",
  ppl: "Push / pull / legs",
};

interface TemplateSlot {
  pattern: Pattern;
  role: SlotRole;
  muscle?: string;
}
interface Template {
  key: string;
  name: string;
  slots: TemplateSlot[];
}

const FB: Template[] = [
  { key: "A", name: "Full Body A", slots: [
    { pattern: "squat", role: "main" }, { pattern: "horizontal_push", role: "main" }, { pattern: "horizontal_pull", role: "secondary" },
    { pattern: "hinge", role: "secondary" }, { pattern: "core_anti_extension", role: "core" }, { pattern: "isolation_arms", role: "isolation", muscle: "biceps" },
  ] },
  { key: "B", name: "Full Body B", slots: [
    { pattern: "hinge", role: "main" }, { pattern: "vertical_pull", role: "main" }, { pattern: "vertical_push", role: "secondary" },
    { pattern: "lunge", role: "secondary" }, { pattern: "core_anti_rotation", role: "core" }, { pattern: "isolation_arms", role: "isolation", muscle: "triceps" },
  ] },
  { key: "C", name: "Full Body C", slots: [
    { pattern: "lunge", role: "main" }, { pattern: "horizontal_pull", role: "main" }, { pattern: "horizontal_push", role: "secondary" },
    { pattern: "squat", role: "accessory" }, { pattern: "carry", role: "core" }, { pattern: "isolation_shoulders", role: "isolation" },
  ] },
];

const UL: Template[] = [
  { key: "UA", name: "Upper A", slots: [
    { pattern: "horizontal_push", role: "main" }, { pattern: "horizontal_pull", role: "main" }, { pattern: "vertical_push", role: "secondary" },
    { pattern: "vertical_pull", role: "secondary" }, { pattern: "isolation_arms", role: "isolation", muscle: "biceps" }, { pattern: "core_anti_rotation", role: "core" },
  ] },
  { key: "LA", name: "Lower A", slots: [
    { pattern: "squat", role: "main" }, { pattern: "hinge", role: "secondary" }, { pattern: "lunge", role: "accessory" },
    { pattern: "isolation_legs", role: "isolation", muscle: "hamstrings" }, { pattern: "core_anti_extension", role: "core" },
  ] },
  { key: "UB", name: "Upper B", slots: [
    { pattern: "vertical_push", role: "main" }, { pattern: "vertical_pull", role: "main" }, { pattern: "horizontal_push", role: "secondary" },
    { pattern: "horizontal_pull", role: "secondary" }, { pattern: "isolation_shoulders", role: "isolation" }, { pattern: "isolation_arms", role: "isolation", muscle: "triceps" },
  ] },
  { key: "LB", name: "Lower B", slots: [
    { pattern: "hinge", role: "main" }, { pattern: "squat", role: "secondary" }, { pattern: "lunge", role: "accessory" },
    { pattern: "isolation_legs", role: "isolation", muscle: "calves" }, { pattern: "carry", role: "core" },
  ] },
];

const PPL: Template[] = [
  { key: "PU", name: "Push", slots: [
    { pattern: "horizontal_push", role: "main" }, { pattern: "vertical_push", role: "secondary" }, { pattern: "isolation_chest", role: "isolation" },
    { pattern: "isolation_shoulders", role: "isolation" }, { pattern: "isolation_arms", role: "isolation", muscle: "triceps" },
  ] },
  { key: "PL", name: "Pull", slots: [
    { pattern: "vertical_pull", role: "main" }, { pattern: "horizontal_pull", role: "secondary" }, { pattern: "horizontal_pull", role: "accessory", muscle: "rear delts" },
    { pattern: "isolation_arms", role: "isolation", muscle: "biceps" }, { pattern: "core_anti_rotation", role: "core" },
  ] },
  { key: "LG", name: "Legs", slots: [
    { pattern: "squat", role: "main" }, { pattern: "hinge", role: "secondary" }, { pattern: "lunge", role: "accessory" },
    { pattern: "isolation_legs", role: "isolation", muscle: "calves" }, { pattern: "core_anti_extension", role: "core" },
  ] },
  { key: "UP", name: "Upper", slots: [
    { pattern: "vertical_push", role: "main" }, { pattern: "horizontal_pull", role: "main" }, { pattern: "horizontal_push", role: "secondary" },
    { pattern: "vertical_pull", role: "secondary" }, { pattern: "isolation_arms", role: "isolation", muscle: "biceps" },
  ] },
  { key: "LO", name: "Lower", slots: [
    { pattern: "hinge", role: "main" }, { pattern: "lunge", role: "secondary" }, { pattern: "squat", role: "accessory" },
    { pattern: "isolation_legs", role: "isolation", muscle: "hamstrings" }, { pattern: "carry", role: "core" },
  ] },
];

const ROLE_PRIORITY: Record<SlotRole, number> = { main: 1, power: 2, secondary: 3, core: 4, accessory: 5, isolation: 6 };

export function sessionTemplates(split: Split, daysPerWeek: number, goal: GoalCategory): { templates: { key: string; name: string; slots: SlotDef[] }[]; rotation: string[] } {
  const tpl = GOAL_TEMPLATES[goal];
  let base: Template[];
  let rotation: string[];
  if (split === "full_body") {
    base = daysPerWeek === 2 ? FB.slice(0, 2) : FB;
    rotation = base.map((t) => t.key);
  } else if (split === "upper_lower") {
    base = UL;
    rotation = ["UA", "LA", "UB", "LB"];
  } else {
    base = daysPerWeek === 5 ? PPL : PPL.slice(0, 3);
    rotation = daysPerWeek === 5 ? ["PU", "PL", "LG", "UP", "LO"] : ["PU", "PL", "LG", "PU", "PL", "LG"];
  }
  // Isolation work: muscle gain, or inherent to body-part splits (5–6 days).
  const keepIsolation = tpl.includesIsolation || split === "ppl";
  const templates = base.map((t) => {
    let slots: TemplateSlot[] = t.slots.filter((s) => keepIsolation || s.role !== "isolation");
    // Performance: power work first, while fresh (skip pure pull days).
    if (tpl.includesPower && t.key !== "PL") slots = [{ pattern: "power", role: "power" }, ...slots];
    return {
      key: t.key,
      name: t.name,
      slots: slots.map((s, i) => ({ id: `${t.key}-${i + 1}`, pattern: s.pattern, role: s.role, priority: ROLE_PRIORITY[s.role] * 10 + i, muscle: s.muscle })),
    };
  });
  return { templates, rotation };
}

// ---------------------------------------------------------------------------
// Phases and prescriptions
// ---------------------------------------------------------------------------

export type TrainingLevel = "none" | "beginner" | "intermediate" | "advanced";

export function defaultPhaseSequence(goal: GoalCategory, level: TrainingLevel, deconditioned: boolean, weeks: number): Phase[] {
  let seq: Phase[];
  if (deconditioned || level === "none" || level === "beginner") seq = ["endurance", "hypertrophy", "strength"];
  else if (goal === "performance") seq = ["hypertrophy", "strength", "power"];
  else if (goal === "muscle_gain") seq = level === "advanced" ? ["hypertrophy", "hypertrophy", "strength"] : ["endurance", "hypertrophy", "hypertrophy"];
  else seq = level === "advanced" ? ["hypertrophy", "hypertrophy", "strength"] : ["endurance", "hypertrophy", "strength"];
  const blocks = Math.ceil(weeks / DELOAD.everyNWeeks);
  while (seq.length < blocks) seq.push(seq[seq.length - 1]);
  return seq.slice(0, blocks);
}

export function phaseForWeek(sequence: Phase[], week: number): Phase {
  const block = Math.floor((week - 1) / DELOAD.everyNWeeks);
  return sequence[Math.min(block, sequence.length - 1)];
}

export function isDeloadWeek(week: number): boolean {
  return week % DELOAD.everyNWeeks === 0;
}

/** Deterministic prescription for a slot role in a given week. */
export function prescribe(phase: Phase, role: SlotRole, week: number, opts: { shortRest?: boolean; minRest?: boolean } = {}): Prescription {
  const v = PHASES[phase];
  const deload = isDeloadWeek(week);
  const b = ((week - 1) % DELOAD.everyNWeeks) + 1; // 1..3 build, 4 = deload
  const buildIdx = Math.min(b, 3);
  let sets: number;
  let repsMin = v.repsMin;
  let repsMax = v.repsMax;
  let rest = role === "main" || role === "power" ? v.restSecMax : v.restSecMin;
  // RPE ceiling climbs across the three build weeks.
  const rpeTop = buildIdx === 1 ? v.rpe[0] : buildIdx === 2 ? Math.min(v.rpe[1], v.rpe[0] + 1) : v.rpe[1];
  let rpe: [number, number] = [v.rpe[0], rpeTop];

  if (role === "main") {
    sets = Math.min(v.setsMax, v.setsMin + (buildIdx - 1));
  } else if (role === "secondary") {
    sets = Math.max(v.setsMin, Math.min(v.setsMax, v.setsMin + (buildIdx - 1)) - 1);
  } else if (role === "power") {
    const p = PHASES.power;
    sets = 3;
    repsMin = 3;
    repsMax = 5;
    rest = p.restSecMin;
    rpe = [p.rpe[0], p.rpe[1]];
  } else {
    // accessory / isolation / core: hypertrophy-style reps in heavy phases
    const h = phase === "strength" || phase === "power" ? PHASES.hypertrophy : v;
    repsMin = h.repsMin;
    repsMax = h.repsMax;
    sets = Math.min(3, Math.max(phase === "endurance" ? 1 : 2, buildIdx === 1 ? 2 : 3));
    if (phase === "endurance") sets = Math.min(v.setsMax, buildIdx);
    rest = h.restSecMin;
    rpe = [h.rpe[0], h.rpe[1]];
  }
  if (opts.shortRest && role !== "main" && role !== "power") rest = Math.max(30, Math.round(rest * 0.75));
  // Time-limited sessions: use the low end of the phase's rest range.
  if (opts.minRest) rest = Math.min(rest, role === "main" || role === "power" ? v.restSecMin : rest);
  if (deload) {
    sets = Math.max(1, Math.round(sets * (1 - DELOAD.setReduction)));
    rpe = [DELOAD.rpe[0], DELOAD.rpe[1]];
  }
  return { sets, reps_min: repsMin, reps_max: repsMax, rest_sec: rest, rpe_min: rpe[0], rpe_max: rpe[1] };
}

const HOLD_WORDS = ["plank", "hold", "carry", "wall sit", "dead bug", "bird dog"];
export function unitFor(exerciseName: string): "reps" | "seconds" {
  const n = exerciseName.toLowerCase();
  return HOLD_WORDS.some((w) => n.includes(w)) && !n.includes("shoulder tap") ? "seconds" : "reps";
}

/** Holds are prescribed as seconds; map a rep range to seconds (≈3 s/rep). */
export function holdSeconds(p: Prescription): [number, number] {
  return [Math.max(15, p.reps_min * 3), Math.max(20, p.reps_max * 3)];
}

/** Estimated session minutes = Σ sets × (time under load + rest). */
export function estimateSessionMinutes(slots: { id: string; unit: "reps" | "seconds" }[], prescriptions: Record<string, Prescription>, phase: Phase): number {
  let sec = 0;
  for (const s of slots) {
    const p = prescriptions[s.id];
    if (!p) continue;
    const avgReps = (p.reps_min + p.reps_max) / 2;
    const tul = s.unit === "seconds" ? (holdSeconds(p)[0] + holdSeconds(p)[1]) / 2 : avgReps * PHASES[phase].secPerRep;
    sec += p.sets * (tul + p.rest_sec);
  }
  return Math.round(sec / 60);
}

// ---------------------------------------------------------------------------
// Exercise candidates
// ---------------------------------------------------------------------------

export interface CandidateFilter {
  equipment: EquipmentAccess;
  injuryAreas: string[];
  dislikes: string[];
}

export function equipmentSet(access: EquipmentAccess): Set<string> {
  return new Set(EQUIPMENT_ACCESS[access]);
}

export function isUsable(ex: LibExercise, f: CandidateFilter): boolean {
  const eq = equipmentSet(f.equipment);
  if (!ex.equipment.every((e) => eq.has(e))) return false;
  if (ex.contraindications.some((c) => f.injuryAreas.includes(c))) return false;
  const name = ex.name.toLowerCase();
  if (f.dislikes.some((d) => d.trim().length > 2 && name.includes(d.trim().toLowerCase()))) return false;
  return true;
}

function chainDepth(ex: LibExercise, byId: Map<string, LibExercise>): number {
  let d = 1;
  let cur = ex;
  const seen = new Set<string>([ex.id]);
  while (cur.regression_id && byId.has(cur.regression_id) && !seen.has(cur.regression_id)) {
    seen.add(cur.regression_id);
    cur = byId.get(cur.regression_id)!;
    d++;
  }
  return d;
}

/** Walk the regression/progression chain to the nearest usable exercise. */
export function nearestInChain(ex: LibExercise, dir: "regression" | "progression", byId: Map<string, LibExercise>, f: CandidateFilter): LibExercise | null {
  const seen = new Set<string>([ex.id]);
  let cur: LibExercise | undefined = ex;
  for (let i = 0; i < 6 && cur; i++) {
    const next: string | null = dir === "regression" ? cur.regression_id : cur.progression_id;
    if (!next || seen.has(next)) return null;
    seen.add(next);
    cur = byId.get(next);
    if (cur && isUsable(cur, f)) return cur;
  }
  return null;
}

/**
 * Regression/progression for a chosen exercise: nearest usable link in its
 * chain, else the nearest easier/harder usable exercise of the same pattern
 * (by chain depth), else — for main and secondary lifts — a method-based
 * option on the same exercise so every main lift has both.
 */
export function resolveVariation(ex: LibExercise, dir: "regression" | "progression", lib: LibExercise[], f: CandidateFilter, methodFallback: boolean): ExerciseRef | null {
  const byId = new Map(lib.map((e) => [e.id, e]));
  const chain = nearestInChain(ex, dir, byId, f);
  if (chain) return { id: chain.id, name: chain.name };
  const depth = chainDepth(ex, byId);
  const same = lib
    .filter((e) => e.id !== ex.id && e.pattern === ex.pattern && e.is_compound === ex.is_compound && isUsable(e, f))
    .map((e) => ({ e, d: chainDepth(e, byId) }))
    .filter((x) => (dir === "regression" ? x.d < depth : x.d > depth))
    .sort((a, b) => (dir === "regression" ? b.d - a.d : a.d - b.d) || a.e.name.localeCompare(b.e.name));
  if (same[0]) return { id: same[0].e.id, name: same[0].e.name };
  if (!methodFallback) return null;
  return dir === "regression"
    ? { id: "", name: `${ex.name} — lighter load, shorter range of motion or slower tempo` }
    : { id: "", name: `${ex.name} — add load once the top of the rep range is reached (double progression), or slow the tempo` };
}

const TARGET_DEPTH: Record<TrainingLevel, number> = { none: 1, beginner: 2, intermediate: 3, advanced: 4 };

export function candidatesForSlot(slot: SlotDef, lib: LibExercise[], f: CandidateFilter, level: TrainingLevel): LibExercise[] {
  const byId = new Map(lib.map((e) => [e.id, e]));
  const wantCompound = slot.role === "main" || slot.role === "secondary";
  const list = lib.filter(
    (e) => e.pattern === slot.pattern && (!slot.muscle || e.primary_muscles.some((m) => m.includes(slot.muscle!))) && isUsable(e, f),
  );
  const target = TARGET_DEPTH[level];
  // Prefer the client's "best" equipment: bands are a fallback when free weights/machines exist.
  const equipFit = (e: LibExercise) => {
    if (f.equipment === "bodyweight") return 0;
    const usesLoad = e.equipment.some((q) => ["barbell", "dumbbell", "kettlebell", "cable", "machine"].includes(q));
    const bandOnly = e.equipment.includes("band") && !usesLoad;
    return (bandOnly ? 1.5 : 0) + (usesLoad ? -0.5 : 0);
  };
  const score = (e: LibExercise) => {
    let s = Math.abs(chainDepth(e, byId) - target) + equipFit(e);
    if (wantCompound && !e.is_compound) s += 5;
    if (slot.role === "main") {
      if (!nearestInChain(e, "regression", byId, f)) s += 3;
      if (!nearestInChain(e, "progression", byId, f)) s += 3;
    }
    return s;
  };
  return list.map((e) => ({ e, s: score(e) })).sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name)).map((x) => x.e);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const DEFAULT_DAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

export function liftingDays(daysPerWeek: number, preferred: number[]): number[] {
  const uniq = Array.from(new Set(preferred)).sort((a, b) => a - b);
  if (uniq.length >= daysPerWeek) return uniq.slice(0, daysPerWeek);
  return DEFAULT_DAYS[daysPerWeek] ?? DEFAULT_DAYS[3];
}

/** Cardio goes on non-lifting days first, then after lifting sessions. */
export function cardioDays(sessions: number, lifting: number[]): number[] {
  const nonLifting = [0, 1, 2, 3, 4, 5, 6].filter((d) => !lifting.includes(d));
  // Spread: prefer non-lifting weekdays (Sunday last — weigh-in/rest day)
  const ordered = [...nonLifting.filter((d) => d !== 0), ...nonLifting.filter((d) => d === 0), ...lifting];
  return ordered.slice(0, Math.min(sessions, 7)).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Cardio prescription
// ---------------------------------------------------------------------------

export function cardioPrescription(p: {
  goal: GoalCategory;
  weeks: number;
  deconditioned: boolean;
  age: number;
  liftingDays: number[];
  hrCeiling?: number | null;
  removed?: boolean;
  removedReason?: string;
}): CardioPlan {
  const rule = GOAL_TEMPLATES[p.goal].cardio;
  const activity = p.deconditioned ? rule.deconditionedActivity : rule.defaultActivity;
  let freq = rule.freqMin;
  let minutes = p.deconditioned ? rule.minMin : Math.min(rule.minMax, rule.minMin + 10);
  const weeks: CardioWeek[] = [];
  for (let w = 1; w <= p.weeks; w++) {
    if (w > 1 && (w - 1) % 4 === 0) {
      // progress at the start of each block
      if (rule.weeklyTargetMin && freq * minutes < rule.weeklyTargetMin) {
        if (minutes < 30) minutes = Math.min(rule.minMax, minutes + 5);
        else freq = Math.min(rule.freqMax, freq + 1);
      } else if (minutes < rule.minMax) {
        minutes = Math.min(rule.minMax, minutes + 5);
      } else if (freq < rule.freqMax) {
        freq += 1;
      }
    }
    weeks.push({ week: w, sessions: p.removed ? 0 : freq, minutes: p.removed ? 0 : minutes });
  }
  const zone = rule.zone;
  const max = hrMax(p.age);
  let hr: { min: number; max: number } | null = null;
  if (zone !== "any") {
    const z = HR_ZONES[zone];
    hr = { min: Math.round(max * z.pctMin), max: Math.round(max * z.pctMax) };
  }
  if (p.hrCeiling && hr) hr = { min: Math.min(hr.min, p.hrCeiling), max: Math.min(hr.max, p.hrCeiling) };
  const firstSessions = weeks[0]?.sessions ?? 0;
  return {
    removed: Boolean(p.removed),
    removed_reason: p.removedReason,
    activity,
    met: METS[activity].met,
    zone,
    hr_bpm: hr,
    rpe: zone === "zone2" ? HR_ZONES.zone2.rpe : zone === "zone3" ? HR_ZONES.zone3.rpe : "any (4–8)",
    intensity: rule.intensity,
    days: cardioDays(firstSessions, p.liftingDays),
    weeks,
  };
}

// ---------------------------------------------------------------------------
// Mobility
// ---------------------------------------------------------------------------

export const MOBILITY_MINUTES = 15;

export function mobilityPlan(lifting: number[], lib: LibExercise[], f: CandidateFilter, count = 6): MobilityPlan {
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => !lifting.includes(d));
  const flow = lib.filter((e) => e.pattern === "mobility" && isUsable(e, f)).slice(0, count).map((e) => ({ id: e.id, name: e.name }));
  return { sessions_per_week: days.length, minutes: MOBILITY_MINUTES, days, flow };
}

// ---------------------------------------------------------------------------
// Assemble the skeleton
// ---------------------------------------------------------------------------

export interface SkeletonInput {
  goal: GoalCategory;
  daysPerWeek: number;
  sessionLengthMin: number;
  preferredDays: number[];
  weeks: number;
  phaseSequence: Phase[];
  level: TrainingLevel;
  deconditioned: boolean;
  age: number;
  filter: CandidateFilter;
  hrCeiling?: number | null;
  cardioRemoved?: boolean;
  cardioRemovedReason?: string;
}

export interface SlotWithCandidates extends SlotDef {
  candidates: LibExercise[];
}

export interface Skeleton {
  split: Split;
  rotation: string[];
  lifting_days: number[];
  sessions: { key: string; name: string; slots: SlotWithCandidates[] }[];
  cardio: CardioPlan;
  mobility: MobilityPlan;
}

export function buildSkeleton(input: SkeletonInput, lib: LibExercise[]): Skeleton {
  const split = chooseSplit(input.daysPerWeek);
  const { templates, rotation } = sessionTemplates(split, input.daysPerWeek, input.goal);
  const lifting = liftingDays(input.daysPerWeek, input.preferredDays);
  const sessions = templates.map((t) => ({
    key: t.key,
    name: t.name,
    slots: t.slots
      .map((s) => ({ ...s, candidates: candidatesForSlot(s, lib, input.filter, input.level) }))
      .filter((s) => s.candidates.length > 0),
  }));
  return {
    split,
    rotation,
    lifting_days: lifting,
    sessions,
    cardio: cardioPrescription({ goal: input.goal, weeks: input.weeks, deconditioned: input.deconditioned, age: input.age, liftingDays: lifting, hrCeiling: input.hrCeiling, removed: input.cardioRemoved, removedReason: input.cardioRemovedReason }),
    mobility: mobilityPlan(lifting, lib, input.filter),
  };
}

/** Default (non-LLM) choice per slot: best-ranked candidate, avoiding repeats. */
export function defaultSelection(sk: Skeleton): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const s of sk.sessions) {
    const inSession = new Set<string>();
    for (const slot of s.slots) {
      const pick = slot.candidates.find((c) => !used.has(c.id) && !inSession.has(c.id)) ?? slot.candidates.find((c) => !inSession.has(c.id)) ?? slot.candidates[0];
      out[slot.id] = pick.id;
      used.add(pick.id);
      inSession.add(pick.id);
    }
  }
  return out;
}

/**
 * Week-by-week prescriptions. Within each 4-week block, if the heaviest week
 * doesn't fit the client's session length (plus warm-up), the lowest-priority
 * slots are left out for that block (no prescription = not performed).
 */
export function buildWeeks(sessions: SessionPlan[], weeks: number, sequence: Phase[], shortRest: boolean, sessionLengthMin = 999): WeekPlan[] {
  const blockLen = DELOAD.everyNWeeks;
  const dropped = new Map<number, Set<string>>(); // block index → slot ids left out
  const minRest = new Map<number, boolean>(); // block index → rest at the low end of the range
  const blocks = Math.ceil(weeks / blockLen);
  for (let b = 0; b < blocks; b++) {
    const phase = sequence[Math.min(b, sequence.length - 1)];
    const heaviest = Math.min(b * blockLen + 3, weeks); // week 3 of the block
    const drop = new Set<string>();
    let shortenRest = false;
    for (const s of sessions) {
      const active = [...s.slots];
      const over = () => {
        const rx = Object.fromEntries(active.map((x) => [x.id, prescribe(phase, x.role, heaviest, { shortRest, minRest: shortenRest })]));
        return estimateSessionMinutes(active, rx, phase) + WARMUP_MIN > sessionLengthMin;
      };
      const dropOne = () => {
        const worst = [...active].sort((x, y) => y.priority - x.priority)[0];
        active.splice(active.indexOf(worst), 1);
        drop.add(worst.id);
      };
      while (active.length > 4 && over()) dropOne();
      if (over()) shortenRest = true;
      while (active.length > 3 && over()) dropOne();
    }
    dropped.set(b, drop);
    minRest.set(b, shortenRest);
  }
  const out: WeekPlan[] = [];
  for (let w = 1; w <= weeks; w++) {
    const phase = phaseForWeek(sequence, w);
    const block = Math.floor((w - 1) / blockLen);
    const drop = dropped.get(block) ?? new Set<string>();
    const prescriptions: Record<string, Prescription> = {};
    const minutes: Record<string, number> = {};
    for (const s of sessions) {
      for (const slot of s.slots) if (!drop.has(slot.id)) prescriptions[slot.id] = prescribe(phase, slot.role, w, { shortRest, minRest: minRest.get(block) });
      minutes[s.key] = estimateSessionMinutes(s.slots, prescriptions, phase);
    }
    out.push({ week: w, phase, deload: isDeloadWeek(w), retest: isDeloadWeek(w), prescriptions, session_minutes: minutes });
  }
  return out;
}

/** Recompute a week's estimated minutes after edits. */
export function recomputeWeekMinutes(sessions: SessionPlan[], week: WeekPlan): WeekPlan {
  const minutes: Record<string, number> = {};
  for (const s of sessions) minutes[s.key] = estimateSessionMinutes(s.slots, week.prescriptions, week.phase);
  return { ...week, session_minutes: minutes };
}

/**
 * Apply exercise choices to the skeleton and produce the training plan.
 * Slots are trimmed (lowest priority first) until every non-deload week fits
 * the client's session length.
 */
export function assembleTraining(
  sk: Skeleton,
  choices: Record<string, { exercise_id: string; note?: string }>,
  lib: LibExercise[],
  p: { weeks: number; phaseSequence: Phase[]; sessionLengthMin: number; filter: CandidateFilter; shortRest: boolean; guidelines: string[]; clearanceNotes: string | null; coachingNotes: string[]; summary: string; source: "llm" | "library_default" },
): TrainingPlan {
  const byId = new Map(lib.map((e) => [e.id, e]));
  const sessions: SessionPlan[] = sk.sessions.map((s) => ({
    key: s.key,
    name: s.name,
    slots: s.slots.map((slot): SlotChoice => {
      const chosen = byId.get(choices[slot.id]?.exercise_id ?? "") ?? slot.candidates[0];
      const { candidates: _c, ...def } = slot;
      void _c;
      return {
        ...def,
        exercise: { id: chosen.id, name: chosen.name },
        regression: resolveVariation(chosen, "regression", lib, p.filter, slot.role === "main" || slot.role === "secondary"),
        progression: resolveVariation(chosen, "progression", lib, p.filter, slot.role === "main" || slot.role === "secondary"),
        note: choices[slot.id]?.note ?? "",
        unit: unitFor(chosen.name),
      };
    }),
  }));

  return {
    split: sk.split,
    split_label: SPLIT_LABELS[sk.split],
    lifting_days: sk.lifting_days,
    sessions,
    rotation: sk.rotation,
    weeks: buildWeeks(sessions, p.weeks, p.phaseSequence, p.shortRest, p.sessionLengthMin),
    cardio: sk.cardio,
    mobility: sk.mobility,
    coaching_notes: p.coachingNotes,
    program_summary: p.summary,
    guidelines: p.guidelines,
    clearance_notes: p.clearanceNotes,
    selection_source: p.source,
  };
}

/** Session key scheduled on each lifting day of a given week. */
export function sessionsForWeek(t: Pick<TrainingPlan, "rotation" | "lifting_days">, week: number): { day: number; key: string }[] {
  const perWeek = t.lifting_days.length;
  return t.lifting_days.map((day, i) => ({ day, key: t.rotation[((week - 1) * perWeek + i) % t.rotation.length] }));
}

/** Exercise loads (for the energy model) in a given plan week. */
export function exerciseLoadsForWeek(t: TrainingPlan, week: number): ExerciseLoad[] {
  const w = t.weeks[Math.min(Math.max(week, 1), t.weeks.length) - 1];
  const loads: ExerciseLoad[] = [];
  if (w) {
    const met = METS[PHASES[w.phase].metKey].met;
    for (const { key } of sessionsForWeek(t, w.week)) {
      loads.push({ category: "strength", label: `Strength ${key}`, met, minutes: w.session_minutes[key] ?? 0, perWeek: 1 });
    }
  }
  const cw = t.cardio.weeks[Math.min(Math.max(week, 1), t.cardio.weeks.length) - 1];
  if (cw && !t.cardio.removed && cw.sessions > 0) {
    loads.push({ category: "cardio", label: METS[t.cardio.activity].label, met: t.cardio.met, minutes: cw.minutes, perWeek: cw.sessions });
  }
  if (t.mobility.sessions_per_week > 0) {
    loads.push({ category: "mobility", label: "Mobility / recovery", met: METS.mobility.met, minutes: t.mobility.minutes, perWeek: t.mobility.sessions_per_week });
  }
  return loads;
}
