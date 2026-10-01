import { describe, expect, it } from "vitest";
import { buildRequest, validateSelection } from "./selection";
import { buildSkeleton } from "./training";
import { EX_LIB } from "@/test/fixtures";

const sk = buildSkeleton({ goal: "muscle_gain", daysPerWeek: 3, sessionLengthMin: 60, preferredDays: [], weeks: 12, phaseSequence: ["hypertrophy", "hypertrophy", "strength"], level: "intermediate", deconditioned: false, age: 30, filter: { equipment: "commercial_gym", injuryAreas: [], dislikes: [] } }, EX_LIB);
const client = { goal_label: "Muscle gain", primary_goal: "", success_90_days: "", sport_activity: "", training_history: "intermediate", equipment: "commercial_gym", exercise_likes: "", cardio_preferences: "", split_label: "Full body", phases: [] };
const { request, codeToId } = buildRequest(sk, client);

function validRaw() {
  return {
    choices: request.sessions.flatMap((s) => s.slots.map((sl, i) => ({ slot_id: sl.slot_id, exercise_code: sl.candidates[Math.min(i, sl.candidates.length - 1) === i ? 0 : 0].code, note: "Brace before each rep." }))),
    coaching_notes: ["Own the setup.", "Stop sets with good form.", "Log every session."],
    program_summary: "A full-body hypertrophy block building toward strength.",
  };
}

describe("LLM selection validation", () => {
  it("accepts a valid selection and maps codes back to exercise ids", () => {
    const r = validateSelection(validRaw(), request, codeToId);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const first = request.sessions[0].slots[0];
      expect(r.value.choices[first.slot_id].exercise_id).toBe(codeToId.get(first.candidates[0].code));
    }
  });
  it("rejects numerals anywhere in LLM text", () => {
    const raw = validRaw();
    raw.choices[0].note = "Do 3 sets of 10";
    expect(validateSelection(raw, request, codeToId).ok).toBe(false);
    const raw2 = validRaw();
    raw2.program_summary = "Lose 2 lb per week";
    expect(validateSelection(raw2, request, codeToId).ok).toBe(false);
  });
  it("rejects exercises outside the slot's candidate list", () => {
    const raw = validRaw();
    raw.choices[0].exercise_code = "X999";
    const r = validateSelection(raw, request, codeToId);
    expect(r.ok).toBe(false);
  });
  it("rejects missing slots and duplicates within a session", () => {
    const raw = validRaw();
    raw.choices.pop();
    expect(validateSelection(raw, request, codeToId).ok).toBe(false);
    const raw2 = validRaw();
    const s0 = request.sessions[0];
    const shared = s0.slots[0].candidates[0].code;
    const other = s0.slots.find((sl, i) => i > 0 && sl.candidates.some((c) => c.code === shared));
    if (other) {
      raw2.choices.find((c) => c.slot_id === other.slot_id)!.exercise_code = shared;
      expect(validateSelection(raw2, request, codeToId).ok).toBe(false);
    }
  });
  it("rejects non-JSON-shaped output", () => {
    expect(validateSelection("not json", request, codeToId).ok).toBe(false);
    expect(validateSelection({ choices: [] }, request, codeToId).ok).toBe(false);
  });
});
