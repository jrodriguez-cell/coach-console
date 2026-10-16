/**
 * Edits to a generated program, on drafts and approved plans alike: swap,
 * add or remove an exercise, and add (or change) the client's skill goal
 * work without regenerating. Pure: takes a training plan, returns a new one;
 * every number still comes from prescribe().
 */
import { SKILLS, startStep, type SkillKey } from "@/config/skills";
import { MOBILITY, WEAKNESSES, type MobilityArea, type WeakMovement } from "@/config/coach-notes";
import type { CoachNote } from "./intake";
import type { Pattern } from "@/data/exercises";
import type { LibExercise, Prescription, SessionPlan, SlotChoice, SlotRole, TrainingPlan } from "./plan-types";
import {
  blockOfWeek, candidatesForSlot, isUsable, prescribe, recomputeWeekMinutes, resolveVariation, skillLadder, unitFor,
  type CandidateFilter, type TrainingLevel,
} from "./training";

export interface EditContext {
  lib: LibExercise[];
  filter: CandidateFilter;
  level: TrainingLevel;
}

/** Session key without the block suffix ("UA2" -> "UA"). */
const baseKey = (k: string) => k.replace(/\d+$/, "");
const slotIndex = (id: string) => id.slice(id.lastIndexOf("-") + 1);

/** Weeks a session is used in: its own 4-week block, or every week. */
function weeksOf(t: TrainingPlan, s: SessionPlan): number[] {
  return t.weeks.map((w) => w.week).filter((w) => s.block == null || blockOfWeek(w) === s.block - 1);
}

function choice(ex: LibExercise, def: Omit<SlotChoice, "exercise" | "regression" | "progression" | "note" | "unit">, ctx: EditContext): SlotChoice {
  const main = def.role === "main" || def.role === "secondary";
  return {
    ...def,
    exercise: { id: ex.id, name: ex.name },
    regression: resolveVariation(ex, "regression", ctx.lib, ctx.filter, main),
    progression: resolveVariation(ex, "progression", ctx.lib, ctx.filter, main),
    note: "",
    unit: unitFor(ex.name),
  };
}

/** Prescription for a new slot in a week, never harder than that week's hardest existing work. */
function rxFor(t: TrainingPlan, week: number, role: SlotRole): Prescription {
  const w = t.weeks[week - 1];
  const rx = prescribe(w.phase, role, week);
  const cap = Math.max(0, ...Object.values(w.prescriptions).map((p) => p.rpe_max));
  return cap ? { ...rx, rpe_min: Math.min(rx.rpe_min, cap), rpe_max: Math.min(rx.rpe_max, cap) } : rx;
}

const finish = (t: TrainingPlan): TrainingPlan => ({ ...t, weeks: t.weeks.map((w) => recomputeWeekMinutes(t.sessions, w)) });

/** Is this exercise an allowed replacement for the slot? */
export function canSwap(slot: Pick<SlotChoice, "pattern" | "role" | "skill">, ex: LibExercise, ctx: EditContext): string | null {
  if (!isUsable(ex, ctx.filter)) return "That exercise needs unavailable equipment, is contraindicated, or is on the client's dislike list.";
  const onLadder = slot.role === "skill" && slot.skill && ex.slug ? SKILLS[slot.skill].ladder.includes(ex.slug) : false;
  if (slot.role === "skill" ? !onLadder : ex.pattern !== slot.pattern) return slot.role === "skill" ? "Pick a step from this skill's progression." : "Pick an exercise with the same movement pattern.";
  return null;
}

/**
 * Swap the exercise in a slot. scope "block": that session for its 4-week
 * block; "plan": the same position in every block of that session.
 */
export function swapExercise(t: TrainingPlan, slotId: string, ex: LibExercise, scope: "block" | "plan", ctx: EditContext): TrainingPlan {
  const out: TrainingPlan = structuredClone(t);
  const target = out.sessions.find((s) => s.slots.some((x) => x.id === slotId));
  if (!target) return t;
  const idx = slotIndex(slotId);
  const sessions = scope === "plan" ? out.sessions.filter((s) => baseKey(s.key) === baseKey(target.key)) : [target];
  for (const s of sessions) {
    s.slots = s.slots.map((sl) => {
      if (!(sl.id === slotId || (scope === "plan" && slotIndex(sl.id) === idx && sl.pattern === target.slots.find((x) => x.id === slotId)!.pattern))) return sl;
      if (sl.role === "skill") return sl.id === slotId ? { ...choice(ex, sl, ctx), id: sl.id } : sl; // skill steps progress per block
      return { ...choice(ex, sl, ctx), id: sl.id };
    });
  }
  return finish(out);
}

const ROLE_FOR: Partial<Record<Pattern, SlotRole>> = {
  isolation_arms: "isolation", isolation_shoulders: "isolation", isolation_legs: "isolation", isolation_chest: "isolation",
  core_anti_extension: "core", core_anti_rotation: "core", core_flexion: "core", carry: "core", mobility: "accessory", power: "power",
};

/** Add an exercise to a session (and the same session in later blocks when scope is "plan"). */
export function addExercise(t: TrainingPlan, sessionKey: string, ex: LibExercise, scope: "block" | "plan", ctx: EditContext): TrainingPlan {
  const out: TrainingPlan = structuredClone(t);
  const first = out.sessions.find((s) => s.key === sessionKey);
  if (!first) return t;
  const role = ROLE_FOR[ex.pattern] ?? "accessory";
  const targets = scope === "plan" ? out.sessions.filter((s) => baseKey(s.key) === baseKey(sessionKey) && (s.block ?? 1) >= (first.block ?? 1)) : [first];
  for (const s of targets) {
    const n = Math.max(0, ...s.slots.map((x) => Number(slotIndex(x.id)) || 0)) + 1;
    const id = `${s.key}-${n}`;
    s.slots.push({ ...choice(ex, { id, pattern: ex.pattern, role, priority: 90 + n }, ctx), id });
    for (const w of weeksOf(out, s)) out.weeks[w - 1].prescriptions[id] = rxFor(out, w, role);
  }
  return finish(out);
}

/** Remove a slot from a session (and the same position in later blocks when scope is "plan"). */
export function removeExercise(t: TrainingPlan, slotId: string, scope: "block" | "plan"): TrainingPlan {
  const out: TrainingPlan = structuredClone(t);
  const target = out.sessions.find((s) => s.slots.some((x) => x.id === slotId));
  if (!target) return t;
  const ids = new Set<string>([slotId]);
  if (scope === "plan") {
    // Same position in the same session's later blocks (block versions keep positions).
    for (const s of out.sessions) if (baseKey(s.key) === baseKey(target.key) && (s.block ?? 1) >= (target.block ?? 1)) for (const sl of s.slots) if (slotIndex(sl.id) === slotIndex(slotId)) ids.add(sl.id);
  }
  for (const s of out.sessions) s.slots = s.slots.filter((x) => !ids.has(x.id));
  for (const w of out.weeks) for (const id of Array.from(ids)) delete w.prescriptions[id];
  return finish(out);
}

/**
 * Build (or replace, or remove) the skill goal's work in an existing
 * program: every session opens with the skill step for its block (one rung
 * up per 4-week block) and gets two pieces of supporting work.
 */
export function applySkill(t: TrainingPlan, skill: SkillKey | null, ctx: EditContext): TrainingPlan {
  let out: TrainingPlan = structuredClone(t);
  // Clear any existing skill work.
  const old = new Set(out.sessions.flatMap((s) => s.slots.filter((x) => x.skill).map((x) => x.id)));
  for (const s of out.sessions) s.slots = s.slots.filter((x) => !old.has(x.id));
  for (const w of out.weeks) for (const id of Array.from(old)) delete w.prescriptions[id];
  out.skill = skill;
  out.split_reasons = (out.split_reasons ?? []).filter((r) => !r.startsWith("Skill goal:"));
  if (!skill) return finish(out);

  const def = SKILLS[skill];
  const ladder = skillLadder(skill, ctx.lib, ctx.filter);
  if (!ladder.length) return finish(out);
  const start = startStep(ctx.level, ladder.length);
  const sup = def.support;
  const blocks = new Map<number, SessionPlan[]>();
  for (const s of out.sessions) blocks.set(s.block ?? 1, [...(blocks.get(s.block ?? 1) ?? []), s]);
  for (const [block, sessions] of Array.from(blocks.entries())) {
    sessions.forEach((s, ti) => {
      const step = ladder[Math.min(start + (s.block ? block - 1 : 0), ladder.length - 1)];
      const n0 = Math.max(0, ...s.slots.map((x) => Number(slotIndex(x.id)) || 0)) + 1;
      const stepId = `${s.key}-${n0}`;
      const added: SlotChoice[] = [{ ...choice(step, { id: stepId, pattern: "skill", role: "skill", priority: 0, skill }, ctx), id: stepId }];
      const mine = sup.length <= 2 ? sup : [sup[(2 * ti) % sup.length], sup[(2 * ti + 1) % sup.length]];
      mine.forEach((m, j) => {
        const id = `${s.key}-${n0 + 1 + j}`;
        const def2 = { id, pattern: m.pattern, role: m.role, muscle: m.muscle, slug: m.slug, skill, priority: 44 + j };
        const inSession = new Set([...s.slots, ...added].map((x) => x.exercise.id));
        const ex = candidatesForSlot(def2, ctx.lib, ctx.filter, ctx.level).find((c) => !inSession.has(c.id));
        if (ex) added.push({ ...choice(ex, def2, ctx), id });
      });
      s.slots = [added[0], ...s.slots, ...added.slice(1)];
      for (const w of weeksOf(out, s)) for (const a of added) out.weeks[w - 1].prescriptions[a.id] = rxFor(out, w, a.role);
    });
  }
  out.split_reasons = [
    `Skill goal: ${def.label}. Every session starts with the ${def.label.toLowerCase()} progression while fresh, plus its supporting work; the step moves up each 4-week block. ${def.progressCue}`,
    ...(out.split_reasons ?? []),
  ];
  out = finish(out);
  return out;
}

/**
 * Re-fit the current program to updated client details without
 * regenerating: any exercise the client can no longer do (new equipment,
 * injury or dislike) is swapped for the best one that fits, and a skill
 * goal named in the new goals is added. Returns what changed.
 */
export function refitProgram(t: TrainingPlan, ctx: EditContext, skill: SkillKey | null): { training: TrainingPlan; changes: string[] } {
  let out: TrainingPlan = structuredClone(t);
  const changes: string[] = [];
  const byId = new Map(ctx.lib.map((e) => [e.id, e]));
  const drop = new Set<string>();
  for (const s of out.sessions) {
    s.slots = s.slots.map((sl) => {
      const ex = byId.get(sl.exercise.id);
      if (!ex || isUsable(ex, ctx.filter)) return sl;
      const inSession = new Set(s.slots.map((x) => x.exercise.id));
      const pick =
        sl.role === "skill" && sl.skill
          ? skillLadder(sl.skill, ctx.lib, ctx.filter)[0]
          : candidatesForSlot({ ...sl, slug: undefined }, ctx.lib, ctx.filter, ctx.level).find((c) => !inSession.has(c.id));
      if (!pick) {
        changes.push(`${s.name}: removed ${sl.exercise.name} (nothing similar fits)`);
        drop.add(sl.id);
        return sl;
      }
      changes.push(`${s.name}: ${sl.exercise.name} → ${pick.name}`);
      return { ...choice(pick, sl, ctx), id: sl.id };
    });
    s.slots = s.slots.filter((x) => !drop.has(x.id));
  }
  for (const w of out.weeks) for (const id of Array.from(drop)) delete w.prescriptions[id];
  if (skill && out.skill !== skill) {
    out = applySkill(out, skill, ctx);
    changes.push(`Added ${SKILLS[skill].label} work to every session`);
  }
  return { training: finish(out), changes: Array.from(new Set(changes)) };
}

/**
 * Apply the client's active coach notes to the program: corrective work for
 * movement weaknesses and mobility drills for limitations, added to the
 * sessions that need them. Work added for notes that are no longer active
 * is removed. (Preferences and pain act through the client's dislikes and
 * injury areas, handled by refitProgram.)
 */
export function applyCoachNotes(t: TrainingPlan, ctx: EditContext, notes: CoachNote[]): { training: TrainingPlan; changes: string[] } {
  const out: TrainingPlan = structuredClone(t);
  const changes: string[] = [];
  const active = notes.filter((n) => n.active);
  const bySlug = new Map(ctx.lib.filter((e) => e.slug).map((e) => [e.slug!, e]));
  // Remove work from notes that are resolved (or re-added below).
  const removed = new Set<string>();
  for (const s of out.sessions) {
    for (const sl of s.slots) if (sl.from_note) {
      removed.add(sl.id);
      if (!active.some((n) => n.id === sl.from_note)) changes.push(`${s.name}: removed ${sl.exercise.name} (note resolved)`);
    }
    s.slots = s.slots.filter((x) => !removed.has(x.id));
  }
  for (const w of out.weeks) for (const id of Array.from(removed)) delete w.prescriptions[id];
  const before = new Set(t.sessions.flatMap((s) => s.slots.filter((x) => x.from_note).map((x) => `${s.key}|${x.from_note}|${x.exercise.id}`)));

  for (const n of active) {
    const rule = n.kind === "weakness" && n.movement && n.movement in WEAKNESSES ? { patterns: WEAKNESSES[n.movement as WeakMovement].patterns, list: WEAKNESSES[n.movement as WeakMovement].work, mobility: false }
      : n.kind === "mobility" && n.mobility && n.mobility in MOBILITY ? { patterns: MOBILITY[n.mobility as MobilityArea].patterns, list: MOBILITY[n.mobility as MobilityArea].drills, mobility: true }
      : null;
    if (!rule) continue;
    for (const s of out.sessions) {
      const needs = s.slots.some((x) => rule.patterns.includes(x.pattern) && (x.role === "main" || x.role === "secondary" || x.role === "core"));
      if (!needs) continue;
      const inSession = new Set(s.slots.map((x) => x.exercise.id));
      const ex = rule.list.map((slug) => bySlug.get(slug)).find((e): e is LibExercise => Boolean(e && isUsable(e, ctx.filter) && !inSession.has(e.id)));
      if (!ex) continue;
      const n0 = Math.max(0, ...s.slots.map((x) => Number(slotIndex(x.id)) || 0)) + 1;
      const id = `${s.key}-${n0}`;
      const role: SlotRole = rule.mobility ? "accessory" : ROLE_FOR[ex.pattern] ?? "accessory";
      const slot: SlotChoice = { ...choice(ex, { id, pattern: ex.pattern, role, priority: 43, from_note: n.id }, ctx), id, note: n.text.slice(0, 120) };
      // Mobility drills go first (after a skill step) as session prep; corrective work at the end.
      if (rule.mobility) {
        const at = s.slots[0]?.role === "skill" ? 1 : 0;
        s.slots.splice(at, 0, slot);
      } else s.slots.push(slot);
      for (const w of weeksOf(out, s)) out.weeks[w - 1].prescriptions[id] = rxFor(out, w, role);
      if (!before.has(`${s.key}|${n.id}|${ex.id}`)) changes.push(`${s.name}: added ${ex.name} (${rule.mobility ? "mobility" : "weakness"} note)`);
    }
  }
  return { training: finish(out), changes: Array.from(new Set(changes)) };
}

/** Step the main lifts of a weak movement down one level (once, when the note is added). */
export function regressMovement(t: TrainingPlan, ctx: EditContext, movement: WeakMovement): { training: TrainingPlan; changes: string[] } {
  const out: TrainingPlan = structuredClone(t);
  const changes: string[] = [];
  const byId = new Map(ctx.lib.map((e) => [e.id, e]));
  const patterns = WEAKNESSES[movement].patterns;
  for (const s of out.sessions) {
    s.slots = s.slots.map((sl) => {
      if (sl.role !== "main" || !patterns.includes(sl.pattern) || !sl.regression?.id) return sl;
      const easier = byId.get(sl.regression.id);
      if (!easier || !isUsable(easier, ctx.filter)) return sl;
      changes.push(`${s.name}: ${sl.exercise.name} → ${easier.name} (easier while the weakness is worked on)`);
      return { ...choice(easier, sl, ctx), id: sl.id };
    });
  }
  return { training: finish(out), changes: Array.from(new Set(changes)) };
}
