import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardrailApprovalIssues } from "@/lib/guardrails";
import { clearanceIssue } from "@/lib/intake";
import { latestClearance, latestIntake, planOverrides } from "./clients";
import type { PlanRow } from "./types";

/**
 * The Approve gate: PAR-Q clearance handled, nothing blocked, and every
 * warning carries an override reason. Enforced server-side on approval.
 */
export async function approvalIssues(db: SupabaseClient, plan: PlanRow): Promise<string[]> {
  const [intake, clearance, overrides] = await Promise.all([latestIntake(db, plan.client_id), latestClearance(db, plan.client_id), planOverrides(db, plan.id)]);
  const issues: string[] = [];
  if (!intake) issues.push("No intake on file.");
  const c = clearanceIssue(Boolean(intake?.parq_flagged), clearance ? { status: clearance.status, notes: [clearance.notes, clearance.exercise_limits, clearance.hr_ceiling ? `HR ${clearance.hr_ceiling}` : "", clearance.rpe_ceiling ? `RPE ${clearance.rpe_ceiling}` : "", clearance.activities_to_avoid].filter(Boolean).join("; "), reason: clearance.reason } : null);
  if (c) issues.push(c);
  issues.push(...guardrailApprovalIssues(plan.guardrail_flags, overrides));
  if (!plan.training && !plan.nutrition?.targets) issues.push("Neither training nor nutrition could be generated.");
  return issues;
}

