/**
 * Acute training variables by phase. Seed defaults — the trainer should
 * confirm them against the ISSA text. Editable here.
 */
export type Phase = "endurance" | "hypertrophy" | "strength" | "power";

export interface PhaseVariables {
  label: string;
  repsMin: number;
  repsMax: number;
  setsMin: number;
  setsMax: number;
  restSecMin: number;
  restSecMax: number;
  /** seconds per rep used to estimate time under load */
  secPerRep: number;
  /** target RPE for working sets */
  rpe: [number, number];
  /** MET key used for the energy model */
  metKey: "resistance_moderate" | "resistance_vigorous";
}

export const PHASES: Record<Phase, PhaseVariables> = {
  endurance: { label: "Muscular Endurance", repsMin: 12, repsMax: 20, setsMin: 1, setsMax: 3, restSecMin: 30, restSecMax: 60, secPerRep: 3, rpe: [6, 7], metKey: "resistance_moderate" },
  hypertrophy: { label: "Hypertrophy", repsMin: 8, repsMax: 12, setsMin: 3, setsMax: 4, restSecMin: 60, restSecMax: 90, secPerRep: 3, rpe: [7, 8], metKey: "resistance_moderate" },
  strength: { label: "Strength", repsMin: 3, repsMax: 6, setsMin: 3, setsMax: 5, restSecMin: 120, restSecMax: 180, secPerRep: 3, rpe: [7, 9], metKey: "resistance_vigorous" },
  power: { label: "Power", repsMin: 1, repsMax: 5, setsMin: 3, setsMax: 5, restSecMin: 120, restSecMax: 180, secPerRep: 1.5, rpe: [6, 8], metKey: "resistance_vigorous" },
};

export const PHASE_ORDER: Phase[] = ["endurance", "hypertrophy", "strength", "power"];

/** Deload every Nth week: ~40% fewer sets, stop at RPE 5–6. */
export const DELOAD = { everyNWeeks: 4, setReduction: 0.4, rpe: [5, 6] as [number, number] };

/**
 * Warm-up/transition minutes reserved when fitting a session to the client's
 * available time. Not counted as exercise energy (session minutes for the
 * energy model are Σ sets × (time under load + rest), per spec).
 */
export const WARMUP_MIN = 8;

export const DEFAULT_PLAN_WEEKS = 12;
