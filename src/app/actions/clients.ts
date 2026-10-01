"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { IntakeAnswersSchema, parqFlagged, PARQ_QUESTIONS, ReferOutSchema, REFER_OUT_KEYS } from "@/lib/intake";
import { GOAL_CATEGORIES, type GoalCategory } from "@/config/goal-templates";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null ? "" : String(v).trim();
};
const list = (f: FormData, k: string) =>
  str(f, k)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

function parseGoal(v: string): GoalCategory {
  if (!(GOAL_CATEGORIES as string[]).includes(v)) throw new Error("Invalid goal category");
  return v as GoalCategory;
}

export async function createClientAction(form: FormData) {
  const db = createClient();
  const { data, error } = await db
    .from("clients")
    .insert({
      name: str(form, "name"),
      email: str(form, "email") || null,
      phone: str(form, "phone") || null,
      status: str(form, "status") || "prospect",
      goal_category: parseGoal(str(form, "goal_category")),
      purpose_text: str(form, "purpose_text") || null,
      start_date: str(form, "start_date") || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/clients/${data.id}/intake`);
}

export async function updateClientAction(clientId: string, form: FormData) {
  const db = createClient();
  const { error } = await db
    .from("clients")
    .update({
      name: str(form, "name"),
      email: str(form, "email") || null,
      phone: str(form, "phone") || null,
      status: str(form, "status"),
      goal_category: parseGoal(str(form, "goal_category")),
      purpose_text: str(form, "purpose_text") || null,
      start_date: str(form, "start_date") || null,
    })
    .eq("id", clientId);
  if (error) throw error;
  revalidatePath(`/clients/${clientId}`);
}

export async function saveIntakeAction(clientId: string, _prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const db = createClient();
  const heightIn = Number(str(form, "height_ft") || 0) * 12 + Number(str(form, "height_in_rem") || 0);
  const current = [0, 1, 2, 3]
    .map((i) => ({ type: str(form, `cx_type_${i}`), sessions_per_week: str(form, `cx_sessions_${i}`), minutes: str(form, `cx_minutes_${i}`) }))
    .filter((r) => r.type && r.sessions_per_week && r.minutes);
  const raw = {
    age: str(form, "age"),
    sex: str(form, "sex"),
    height_in: heightIn,
    weight_lb: str(form, "weight_lb"),
    body_fat_pct: str(form, "body_fat_pct"),
    goal_weight_lb: str(form, "goal_weight_lb"),
    primary_goal: str(form, "primary_goal"),
    success_90_days: str(form, "success_90_days"),
    timeline_event: str(form, "timeline_event"),
    event_date: str(form, "event_date") || null,
    sport_activity: str(form, "sport_activity"),
    training_days_per_week: str(form, "training_days_per_week"),
    session_length_min: str(form, "session_length_min"),
    preferred_days: form.getAll("preferred_days").map(Number),
    equipment: str(form, "equipment"),
    training_history: str(form, "training_history"),
    deconditioned: form.get("deconditioned") === "on",
    current_exercise: current,
    current_exercise_confirmed: form.get("current_exercise_confirmed") === "on" || current.length > 0,
    wearable_active_kcal_per_day: str(form, "wearable_active_kcal_per_day"),
    injuries_text: str(form, "injuries_text"),
    injury_areas: form.getAll("injury_areas").map(String),
    activity_level: str(form, "activity_level"),
    measured_tdee: str(form, "measured_tdee"),
    measured_tdee_days: str(form, "measured_tdee_days"),
    exercise_likes: str(form, "exercise_likes"),
    exercise_dislikes: list(form, "exercise_dislikes"),
    cardio_preferences: str(form, "cardio_preferences"),
    dietary_pattern: str(form, "dietary_pattern") || "omnivore",
    allergies: form.getAll("allergies").map(String),
    foods_excluded: list(form, "foods_excluded"),
    meals_per_day: str(form, "meals_per_day") || 3,
    cooking_time: str(form, "cooking_time") || "moderate",
    supplements: str(form, "supplements"),
  };
  const parsed = IntakeAnswersSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const parq: boolean[] = [];
  for (let i = 0; i < PARQ_QUESTIONS.length; i++) {
    const v = str(form, `parq_${i}`);
    if (v !== "yes" && v !== "no") return { error: `Answer PAR-Q question ${i + 1}.` };
    parq.push(v === "yes");
  }
  const refer = ReferOutSchema.parse({
    ...Object.fromEntries(REFER_OUT_KEYS.map((k) => [k, form.get(`refer_${k}`) === "on"])),
    notes: str(form, "refer_notes"),
  });
  // An acute injury is also an injury.
  if (refer.acute_injury) refer.injury = true;
  const flagged = parqFlagged(parq);
  const { error } = await db.from("intakes").insert({ client_id: clientId, answers: parsed.data, parq_answers: parq, parq_flagged: flagged, refer_out_flags: refer });
  if (error) return { error: error.message };
  if (flagged) {
    const { data: clr } = await db.from("clearances").select("id").eq("client_id", clientId).limit(1);
    if (!clr || clr.length === 0) {
      await db.from("clearances").insert({ client_id: clientId, status: "pending", requested_at: todayIn() });
    }
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function recordClearanceAction(clientId: string, form: FormData) {
  const db = createClient();
  const status = str(form, "status") as "pending" | "received" | "not_required";
  const hr = str(form, "hr_ceiling");
  const rpe = str(form, "rpe_ceiling");
  const row = {
    client_id: clientId,
    status,
    notes: str(form, "notes") || null,
    reason: str(form, "reason") || null,
    exercise_limits: str(form, "exercise_limits") || null,
    hr_ceiling: hr ? Number(hr) : null,
    rpe_ceiling: rpe ? Number(rpe) : null,
    activities_to_avoid: str(form, "activities_to_avoid") || null,
    requested_at: str(form, "requested_at") || todayIn(),
    received_at: status === "received" ? str(form, "received_at") || todayIn() : null,
  };
  if (status === "received" && !row.notes && !row.exercise_limits && !row.hr_ceiling && !row.rpe_ceiling && !row.activities_to_avoid) {
    throw new Error("Clearance received: record the clearance notes (limits, HR/RPE ceiling, activities to avoid).");
  }
  if (status === "not_required" && !row.reason) throw new Error("Record why clearance is not required.");
  const { error } = await db.from("clearances").insert(row);
  if (error) throw error;
  revalidatePath(`/clients/${clientId}`);
}

export async function recordReferralAction(clientId: string, form: FormData) {
  const db = createClient();
  const flag = str(form, "flag");
  const note = str(form, "handled_note");
  if (!(REFER_OUT_KEYS as string[]).includes(flag)) throw new Error("Invalid flag");
  if (!note) throw new Error("Describe how it was handled (e.g. \"referred to RD\", \"physician clearance received\").");
  const { error } = await db.from("referrals").insert({ client_id: clientId, flag, handled_note: note });
  if (error) throw error;
  revalidatePath(`/clients/${clientId}`);
}

export async function logContactAction(clientId: string, form: FormData) {
  const db = createClient();
  const { error } = await db.from("contact_log").insert({ client_id: clientId, date: str(form, "date") || todayIn(), channel: str(form, "channel") || "text", summary: str(form, "summary") || null });
  if (error) throw error;
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/today");
}

export async function deleteContactAction(clientId: string, contactId: string) {
  const db = createClient();
  await db.from("contact_log").delete().eq("id", contactId);
  revalidatePath(`/clients/${clientId}`);
}
