import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratorContext } from "@/lib/generator";
import { IntakeAnswersSchema } from "@/lib/intake";
import { loadExercises, loadFoods } from "./libraries";
import type { AppSettings } from "./settings";
import type {
  CalibrationRow, CheckpointRow, ClearanceRow, ClientRow, ContactRow, IntakeRow, OverrideRow, PlanRow, ReferralRow, TaskRow,
} from "./types";

export async function getClient(db: SupabaseClient, id: string): Promise<ClientRow | null> {
  const { data } = await db.from("clients").select("*").eq("id", id).maybeSingle();
  return data as ClientRow | null;
}

export async function latestIntake(db: SupabaseClient, clientId: string): Promise<IntakeRow | null> {
  const { data } = await db.from("intakes").select("*").eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  return data as IntakeRow | null;
}

export async function latestClearance(db: SupabaseClient, clientId: string): Promise<ClearanceRow | null> {
  const { data } = await db.from("clearances").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as ClearanceRow | null;
}

export async function referrals(db: SupabaseClient, clientId: string): Promise<ReferralRow[]> {
  const { data } = await db.from("referrals").select("*").eq("client_id", clientId).order("handled_at");
  return (data ?? []) as ReferralRow[];
}

/** Current plan = latest approved, else latest draft. */
export async function currentPlan(db: SupabaseClient, clientId: string): Promise<PlanRow | null> {
  const { data } = await db.from("plans").select("*").eq("client_id", clientId).neq("status", "archived").order("version", { ascending: false });
  const rows = (data ?? []) as PlanRow[];
  return rows.find((p) => p.status === "approved") ?? rows[0] ?? null;
}

export async function getPlan(db: SupabaseClient, planId: string): Promise<PlanRow | null> {
  const { data } = await db.from("plans").select("*").eq("id", planId).maybeSingle();
  return data as PlanRow | null;
}

export async function planOverrides(db: SupabaseClient, planId: string): Promise<OverrideRow[]> {
  const { data } = await db.from("guardrail_overrides").select("*").eq("plan_id", planId).order("created_at");
  return (data ?? []) as OverrideRow[];
}

export interface ClientBundle {
  client: ClientRow;
  intake: IntakeRow | null;
  clearance: ClearanceRow | null;
  referrals: ReferralRow[];
  plan: PlanRow | null;
  plans: Pick<PlanRow, "id" | "version" | "status" | "generated_at" | "approved_at">[];
  checkpoints: CheckpointRow[];
  contacts: ContactRow[];
  tasks: TaskRow[];
  overrides: (OverrideRow & { plan_version: number })[];
  calibrations: CalibrationRow[];
}

export async function getClientBundle(db: SupabaseClient, id: string): Promise<ClientBundle | null> {
  const client = await getClient(db, id);
  if (!client) return null;
  const [intake, clearance, refs, plan, plansRes, cps, contacts, tasks, cals] = await Promise.all([
    latestIntake(db, id),
    latestClearance(db, id),
    referrals(db, id),
    currentPlan(db, id),
    db.from("plans").select("id, version, status, generated_at, approved_at").eq("client_id", id).order("version", { ascending: false }),
    db.from("checkpoints").select("*").eq("client_id", id).order("due_date"),
    db.from("contact_log").select("*").eq("client_id", id).order("date", { ascending: false }).limit(50),
    db.from("tasks").select("*").eq("client_id", id).neq("status", "done").order("due_date"),
    db.from("calibrations").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  const plans = (plansRes.data ?? []) as ClientBundle["plans"];
  const planIds = plans.map((p) => p.id);
  const { data: ov } = planIds.length ? await db.from("guardrail_overrides").select("*").in("plan_id", planIds).order("created_at", { ascending: false }) : { data: [] };
  return {
    client,
    intake,
    clearance,
    referrals: refs,
    plan,
    plans,
    checkpoints: (cps.data ?? []) as CheckpointRow[],
    contacts: (contacts.data ?? []) as ContactRow[],
    tasks: (tasks.data ?? []) as TaskRow[],
    overrides: ((ov ?? []) as OverrideRow[]).map((o) => ({ ...o, plan_version: plans.find((p) => p.id === o.plan_id)?.version ?? 0 })),
    calibrations: (cals.data ?? []) as CalibrationRow[],
  };
}

export async function generatorContext(db: SupabaseClient, clientId: string, settings: AppSettings, goalOverride?: GeneratorContext["goal"]): Promise<GeneratorContext> {
  const [client, intake, clearance, refs, exercises, foods] = await Promise.all([
    getClient(db, clientId),
    latestIntake(db, clientId),
    latestClearance(db, clientId),
    referrals(db, clientId),
    loadExercises(db),
    loadFoods(db),
  ]);
  if (!client) throw new Error("Client not found");
  if (!intake) throw new Error("Complete the intake before generating a plan.");
  return {
    goal: goalOverride ?? client.goal_category,
    intake: IntakeAnswersSchema.parse(intake.answers),
    referOut: intake.refer_out_flags,
    referralsHandled: refs.map((r) => ({ flag: r.flag, handled_note: r.handled_note })),
    clearance: clearance
      ? {
          status: clearance.status,
          notes: clearance.notes,
          exercise_limits: clearance.exercise_limits,
          hr_ceiling: clearance.hr_ceiling,
          rpe_ceiling: clearance.rpe_ceiling != null ? Number(clearance.rpe_ceiling) : null,
          activities_to_avoid: clearance.activities_to_avoid,
        }
      : null,
    exercises,
    foods,
    limits: settings.guardrail_limits,
    defaultDeficits: settings.default_deficits,
    uncertainty: settings.uncertainty,
  };
}
