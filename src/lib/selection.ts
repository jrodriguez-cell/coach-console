/**
 * Exercise-selection contract between the deterministic skeleton and the LLM.
 * The LLM may only (a) pick an exercise from each slot's candidate list and
 * (b) write short notes. Output is validated with zod; notes may not contain
 * numerals, so every number in the plan comes from the calculators.
 */
import { z } from "zod";
import type { Skeleton } from "./training";

export interface SelectionRequest {
  client: {
    goal_label: string;
    primary_goal: string;
    success_90_days: string;
    sport_activity: string;
    training_history: string;
    equipment: string;
    exercise_likes: string;
    cardio_preferences: string;
    split_label: string;
    split_reasons?: string[];
    skill_goal?: string;
    /** the trainer's own selection rules */
    trainer_guidance?: string;
    focus?: string[];
    phases: string[];
  };
  sessions: {
    key: string;
    name: string;
    slots: { slot_id: string; pattern: string; role: string; focus?: string; skill_prep?: boolean; candidates: { code: string; name: string }[] }[];
  }[];
}

export interface SelectionResult {
  choices: Record<string, { exercise_id: string; note: string }>;
  coaching_notes: string[];
  program_summary: string;
}

const NO_DIGITS = "Must not contain numerals — sets, reps, loads and all other numbers come from the program calculator.";
export const noteText = (max: number) =>
  z.string().trim().max(max).refine((s) => !/[0-9]/.test(s), NO_DIGITS);

export const RawSelectionSchema = z.object({
  choices: z.array(z.object({ slot_id: z.string(), exercise_code: z.string(), note: noteText(160) })),
  coaching_notes: z.array(noteText(240)).min(3).max(6),
  program_summary: noteText(600).refine((s) => s.length > 0, "Summary required"),
});
export type RawSelection = z.infer<typeof RawSelectionSchema>;

/** Candidate aliases (X001…) so the model never has to copy UUIDs. */
export function buildRequest(sk: Skeleton, client: SelectionRequest["client"]): { request: SelectionRequest; codeToId: Map<string, string> } {
  const idToCode = new Map<string, string>();
  const codeToId = new Map<string, string>();
  const codeFor = (id: string) => {
    let c = idToCode.get(id);
    if (!c) {
      c = `X${String(idToCode.size + 1).padStart(3, "0")}`;
      idToCode.set(id, c);
      codeToId.set(c, id);
    }
    return c;
  };
  return {
    codeToId,
    request: {
      client,
      sessions: sk.sessions.map((s) => ({
        key: s.key,
        name: s.name,
        slots: s.slots.map((sl) => ({
          slot_id: sl.id,
          pattern: sl.pattern.replace(/_/g, " "),
          role: sl.role,
          ...(sl.focus ? { focus: sl.focus } : {}),
          ...(sl.skill && sl.role !== "skill" ? { skill_prep: true } : {}),
          candidates: sl.candidates.slice(0, 12).map((c) => ({ code: codeFor(c.id), name: c.name })),
        })),
      })),
    },
  };
}

/**
 * Validate the model's JSON against the skeleton: every slot answered exactly
 * once, every choice from that slot's candidates, no repeats within a session.
 */
export function validateSelection(raw: unknown, req: SelectionRequest, codeToId: Map<string, string>): { ok: true; value: SelectionResult } | { ok: false; errors: string[] } {
  const parsed = RawSelectionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const errors: string[] = [];
  const bySlot = new Map(parsed.data.choices.map((c) => [c.slot_id, c]));
  if (bySlot.size !== parsed.data.choices.length) errors.push("A slot was answered more than once.");
  const choices: SelectionResult["choices"] = {};
  for (const s of req.sessions) {
    const inSession = new Set<string>();
    for (const sl of s.slots) {
      const c = bySlot.get(sl.slot_id);
      if (!c) {
        errors.push(`Missing choice for slot ${sl.slot_id}.`);
        continue;
      }
      if (!sl.candidates.some((x) => x.code === c.exercise_code)) {
        errors.push(`Slot ${sl.slot_id}: ${c.exercise_code} is not one of its candidates.`);
        continue;
      }
      if (inSession.has(c.exercise_code)) errors.push(`Session ${s.key}: ${c.exercise_code} used twice.`);
      inSession.add(c.exercise_code);
      choices[sl.slot_id] = { exercise_id: codeToId.get(c.exercise_code)!, note: c.note };
    }
  }
  const known = new Set(req.sessions.flatMap((s) => s.slots.map((x) => x.slot_id)));
  for (const c of parsed.data.choices) if (!known.has(c.slot_id)) errors.push(`Unknown slot ${c.slot_id}.`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { choices, coaching_notes: parsed.data.coaching_notes, program_summary: parsed.data.program_summary } };
}

export type Selector = (sk: Skeleton, client: SelectionRequest["client"]) => Promise<SelectionResult & { source: "llm" | "library_default" }>;

export class SelectionError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
    this.name = "SelectionError";
  }
}
