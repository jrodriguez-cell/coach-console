import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClient, getPlan, latestIntake } from "./clients";
import { loadFoods } from "./libraries";
import { getSettings } from "./settings";
import { IntakeAnswersSchema } from "@/lib/intake";
import type { ExportInput } from "@/lib/export/xlsx";

export async function exportInput(db: SupabaseClient, planId: string): Promise<{ input: ExportInput; filename: string } | null> {
  const plan = await getPlan(db, planId);
  if (!plan) return null;
  const [client, intake, foods, settings] = await Promise.all([getClient(db, plan.client_id), latestIntake(db, plan.client_id), loadFoods(db), getSettings(db)]);
  if (!client || !intake) return null;
  const safe = client.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    filename: `${safe}-plan-v${plan.version}${plan.status === "approved" ? "" : "-DRAFT"}`,
    input: {
      clientName: client.name,
      goal: plan.goal_category,
      status: plan.status,
      version: plan.version,
      parameters: plan.parameters,
      training: plan.training,
      nutrition: plan.nutrition,
      intake: IntakeAnswersSchema.parse(intake.answers),
      foods,
      disclaimer: settings.disclaimer,
      clearanceNotes: plan.training?.clearance_notes ?? null,
    },
  };
}
