import type { GoalCategory } from "@/config/goal-templates";
import type { GuardrailResult } from "@/lib/guardrails";
import type { IntakeAnswers, ReferOutFlags, ReferOutFlag } from "@/lib/intake";
import type { NutritionPlan, PlanParameters, TrainingPlan } from "@/lib/plan-types";

export interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "prospect" | "active" | "paused" | "completed";
  goal_category: GoalCategory;
  purpose_text: string | null;
  start_date: string | null;
  created_at: string;
}

export interface IntakeRow {
  id: string;
  client_id: string;
  answers: IntakeAnswers;
  parq_answers: boolean[];
  parq_flagged: boolean;
  refer_out_flags: ReferOutFlags;
  submitted_at: string;
}

export interface ClearanceRow {
  id: string;
  client_id: string;
  status: "pending" | "received" | "not_required";
  notes: string | null;
  reason: string | null;
  exercise_limits: string | null;
  hr_ceiling: number | null;
  rpe_ceiling: number | null;
  activities_to_avoid: string | null;
  requested_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface ReferralRow {
  id: string;
  client_id: string;
  flag: ReferOutFlag;
  handled_note: string;
  handled_at: string;
}

export interface PlanRow {
  id: string;
  client_id: string;
  version: number;
  goal_category: GoalCategory;
  status: "draft" | "approved" | "archived";
  parameters: PlanParameters;
  training: (TrainingPlan & { blocked_reason?: string | null }) | null;
  nutrition: NutritionPlan;
  guardrail_flags: GuardrailResult[];
  generated_at: string;
  approved_at: string | null;
}

export interface CheckpointRow {
  id: string;
  client_id: string;
  plan_id: string;
  week: number;
  kind: "weigh_in" | "measurements" | "retest" | "review";
  due_date: string;
  completed_at: string | null;
  result: Record<string, unknown> | null;
}

export interface OverrideRow {
  id: string;
  plan_id: string;
  rule_key: string;
  original_value: string | null;
  override_value: string | null;
  reason: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  client_id: string | null;
  title: string;
  due_date: string;
  kind: string;
  status: "open" | "done" | "snoozed";
  snoozed_until: string | null;
  source: "rule" | "manual";
  rule_key: string | null;
  created_at: string;
}

export interface ContactRow {
  id: string;
  client_id: string;
  date: string;
  channel: "text" | "email" | "call" | "in_person";
  summary: string | null;
}

export interface CalibrationRow {
  id: string;
  client_id: string;
  plan_id: string;
  checkpoint_id: string | null;
  period_start: string;
  period_end: string;
  weigh_in_points: number;
  observed_lb_per_week: number | null;
  planned_lb_per_week: number | null;
  adherence_pct: number | null;
  implied_daily_balance: number | null;
  recommended_adjustment_kcal: number | null;
  applied_adjustment_kcal: number | null;
  decision: "keep" | "adjust" | "fix_adherence" | "insufficient_data";
  trainer_decision_note: string | null;
  created_at: string;
}

export interface MetricDefRow {
  id: string;
  key: string;
  label: string;
  type: "number" | "scale_1_10" | "boolean" | "time" | "text";
  unit: string | null;
  frequency: "daily" | "weekly" | "checkpoint" | "ad_hoc";
  applies_to: string[];
  is_core: boolean;
  required: boolean;
  active: boolean;
  show_in_charts: boolean;
  used_by_task_rule: boolean;
  display_order: number;
  created_at: string;
  retired_at: string | null;
}

export interface MetricEntryRow {
  id: string;
  client_id: string;
  metric_id: string;
  date: string;
  value_num: number | null;
  value_text: string | null;
  note: string | null;
  source: string;
}
