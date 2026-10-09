import { DEFAULT_DISCLAIMER, TASK_THRESHOLDS, type TaskThresholds } from "@/config/tasks";
import { GUARDRAIL_DEFAULTS, type GuardrailLimits } from "@/config/guardrails";
import { DEFAULT_DEFICIT, UNCERTAINTY } from "@/config/energy";
import type { GoalCategory } from "@/config/goal-templates";

export interface AppSettings {
  disclaimer: string;
  task_thresholds: TaskThresholds;
  guardrail_limits: GuardrailLimits;
  default_deficits: Record<GoalCategory, number>;
  uncertainty: { formula: number; measured: number; calibrated: number };
  /** the trainer's own rules for exercise selection, given to the AI on every plan */
  ai_guidance: string;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  disclaimer: DEFAULT_DISCLAIMER,
  task_thresholds: TASK_THRESHOLDS,
  guardrail_limits: GUARDRAIL_DEFAULTS,
  default_deficits: { ...DEFAULT_DEFICIT },
  uncertainty: { ...UNCERTAINTY },
  ai_guidance: "",
};

