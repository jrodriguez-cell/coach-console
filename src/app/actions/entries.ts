"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveEntries, type EntryInput, type EntryState } from "@/lib/data/entries";
import { todayIn } from "@/lib/dates";
import { MEASUREMENT_SITES } from "@/config/metrics";
import { plannedItemsForWeek, planWeekOf } from "@/lib/schedule";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/entry`);
  revalidatePath(`/clients/${clientId}/progress`);
  revalidatePath("/entry");
  revalidatePath("/progress");
  revalidatePath("/today");
}

export async function saveEntriesAction(clientId: string, _prev: EntryState, form: FormData): Promise<EntryState> {
  const db = createClient();
  let entries: EntryInput[];
  try {
    entries = JSON.parse(str(form, "entries"));
  } catch {
    return { error: "Invalid grid data." };
  }
  const r = await saveEntries(db, clientId, entries, str(form, "confirmed") === "1");
  if (r.saved) revalidateClient(clientId);
  return r;
}

export async function quickWeighInAction(clientId: string, _prev: EntryState, form: FormData): Promise<EntryState> {
  const db = createClient();
  const r = await saveEntries(db, clientId, [{ metric_key: "weight_lb", date: str(form, "date") || todayIn(), raw: str(form, "weight") }], str(form, "confirmed") === "1");
  if (r.saved) revalidateClient(clientId);
  return r;
}

export async function quickCheckinAction(clientId: string, _prev: EntryState, form: FormData): Promise<EntryState> {
  const db = createClient();
  const date = str(form, "date") || todayIn();
  const keys = ["energy_1_10", "sleep_hrs", "adherence_pct", "stress_1_10", "cardio_min", "steps", "notes"];
  const r = await saveEntries(db, clientId, keys.map((k) => ({ metric_key: k, date, raw: str(form, k) })), str(form, "confirmed") === "1");
  if (r.saved != null && !r.error && !r.needsConfirm && form.get("followup") === "on") {
    await db.from("tasks").upsert(
      { client_id: clientId, title: `Follow up: ${str(form, "followup_reason") || "flag from check-in"}`, due_date: date, kind: "outreach", source: "rule", rule_key: "checkin_followup", status: "open" },
      { onConflict: "client_id,rule_key,due_date", ignoreDuplicates: true },
    );
  }
  if (r.saved) revalidateClient(clientId);
  return r;
}

export async function quickMeasurementsAction(clientId: string, _prev: EntryState, form: FormData): Promise<EntryState> {
  const db = createClient();
  const date = str(form, "date") || todayIn();
  const confirmed = str(form, "confirmed") === "1";
  const vals = MEASUREMENT_SITES.map((site) => ({ site, raw: str(form, site) })).filter((x) => x.raw !== "");
  if (!vals.length) return { error: "Enter at least one measurement." };
  const { data: existing } = await db.from("measurements").select("site, value_in").eq("client_id", clientId).eq("date", date);
  const cellErrors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  for (const v of vals) {
    const n = Number(v.raw);
    if (!Number.isFinite(n) || n <= 0 || n > 100) cellErrors[v.site] = "Enter inches (0–100).";
    const ex = existing?.find((e) => e.site === v.site);
    if (ex && Number(ex.value_in) !== n) warnings[v.site] = `Existing ${v.site} for ${date}: ${ex.value_in} in. Saving replaces it.`;
  }
  if (Object.keys(cellErrors).length) return { error: "Fix the highlighted values.", cellErrors };
  if (Object.keys(warnings).length && !confirmed) return { error: null, warnings, needsConfirm: true };
  const { error } = await db.from("measurements").upsert(vals.map((v) => ({ client_id: clientId, date, site: v.site, value_in: Number(v.raw), source: "coach_entered" })), { onConflict: "client_id,date,site" });
  if (error) return { error: error.message };
  revalidateClient(clientId);
  return { error: null, saved: vals.length };
}

export async function createBenchmarkAction(clientId: string, form: FormData) {
  const db = createClient();
  const n = (k: string) => (str(form, k) === "" ? null : Number(str(form, k)));
  const { error } = await db.from("benchmarks").insert({
    client_id: clientId,
    name: str(form, "name"),
    category: str(form, "category") || "habit",
    unit: str(form, "unit") || null,
    direction: str(form, "direction") === "lower_better" ? "lower_better" : "higher_better",
    baseline: n("baseline"),
    target: n("target"),
    target_date: str(form, "target_date") || null,
    metric_id: str(form, "metric_id") || null,
  });
  if (error) throw error;
  revalidateClient(clientId);
}

export async function updateBenchmarkAction(clientId: string, benchmarkId: string, form: FormData) {
  const db = createClient();
  const n = (k: string) => (str(form, k) === "" ? null : Number(str(form, k)));
  const { error } = await db.from("benchmarks").update({ baseline: n("baseline"), target: n("target"), target_date: str(form, "target_date") || null }).eq("id", benchmarkId);
  if (error) throw error;
  revalidateClient(clientId);
}

export async function deleteBenchmarkAction(clientId: string, benchmarkId: string) {
  const db = createClient();
  await db.from("benchmarks").delete().eq("id", benchmarkId);
  revalidateClient(clientId);
}

export async function testResultAction(clientId: string, _prev: EntryState, form: FormData): Promise<EntryState> {
  const db = createClient();
  const benchmarkId = str(form, "benchmark_id");
  const value = Number(str(form, "value"));
  const date = str(form, "date") || todayIn();
  if (!benchmarkId) return { error: "Choose a benchmark." };
  if (!Number.isFinite(value)) return { error: "Enter a number." };
  const { data: same } = await db.from("benchmark_results").select("id, value").eq("benchmark_id", benchmarkId).eq("date", date).maybeSingle();
  if (same && Number(same.value) !== value && str(form, "confirmed") !== "1") {
    return { error: null, needsConfirm: true, warnings: { value: `A result of ${same.value} already exists for ${date}. Saving replaces it.` } };
  }
  if (same) await db.from("benchmark_results").update({ value, note: str(form, "note") || null }).eq("id", same.id);
  else await db.from("benchmark_results").insert({ benchmark_id: benchmarkId, date, value, note: str(form, "note") || null });
  // Set the baseline from the first result if it was blank.
  const { data: b } = await db.from("benchmarks").select("baseline").eq("id", benchmarkId).single();
  if (b && b.baseline == null) await db.from("benchmarks").update({ baseline: value }).eq("id", benchmarkId);
  revalidateClient(clientId);
  return { error: null, saved: 1 };
}

export interface SetInput {
  exercise_id: string;
  set_number: number;
  weight_lb: number | null;
  reps: number | null;
  rpe: number | null;
  is_test: boolean;
}

export async function logSessionAction(clientId: string, _prev: EntryState, form: FormData): Promise<EntryState> {
  const db = createClient();
  let sets: SetInput[] = [];
  try {
    sets = JSON.parse(str(form, "sets") || "[]");
  } catch {
    return { error: "Invalid set data." };
  }
  for (const s of sets) {
    if (s.reps != null && (s.reps < 0 || s.reps > 100)) return { error: "Reps must be 0–100." };
    if (s.rpe != null && (s.rpe < 1 || s.rpe > 10)) return { error: "RPE must be 1–10." };
    if (s.weight_lb != null && (s.weight_lb < 0 || s.weight_lb > 1500)) return { error: "Weight must be 0–1,500 lb." };
  }
  const num = (k: string) => (str(form, k) === "" ? null : Number(str(form, k)));
  const { data, error } = await db
    .from("workout_sessions")
    .insert({
      client_id: clientId,
      plan_id: str(form, "plan_id") || null,
      date: str(form, "date") || todayIn(),
      planned_session_key: str(form, "planned_session_key") || null,
      status: str(form, "status") || "completed",
      duration_min: num("duration_min"),
      avg_rpe: num("avg_rpe"),
      notes: str(form, "notes") || null,
      source: "coach_entered",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const rows = sets.filter((s) => s.exercise_id && (s.reps != null || s.weight_lb != null)).map((s) => ({ ...s, session_id: data.id }));
  if (rows.length) {
    const { error: e2 } = await db.from("set_logs").insert(rows);
    if (e2) return { error: e2.message };
  }
  revalidateClient(clientId);
  return { error: null, saved: rows.length + 1 };
}

export async function markReviewedAction(clientId: string, weekStart: string) {
  const db = createClient();
  await db.from("entry_reviews").upsert({ client_id: clientId, week_start: weekStart, reviewed_at: new Date().toISOString() });
  revalidatePath("/entry");
}

export interface ImportState {
  error: string | null;
  summary?: { sessions: number; sets: number; skipped: string[]; week: number };
}

/** Import a client's filled-in week sheet (Excel) as logged sessions and sets. */
export async function importWeekSheetAction(clientId: string, _prev: ImportState, form: FormData): Promise<ImportState> {
  const file = form.get("sheet");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the Excel file your client sent back." };
  if (file.size > 2_000_000) return { error: "That file is too large for a week sheet." };
  const { readWeekSheet } = await import("@/lib/export/client-week-import");
  let parsed;
  try {
    parsed = await readWeekSheet(await file.arrayBuffer());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that file." };
  }
  if (parsed.meta.clientId !== clientId) return { error: "This sheet belongs to a different client." };
  if (parsed.sessions.length === 0) return { error: "No weights or reps were filled in on this sheet." };
  const db = createClient();
  const skipped: string[] = [];
  let sessions = 0;
  let sets = 0;
  for (const s of parsed.sessions) {
    const { data: existing } = await db.from("workout_sessions").select("id").eq("client_id", clientId).eq("date", s.date).eq("planned_session_key", s.sessionKey).limit(1);
    if (existing && existing.length) {
      skipped.push(s.date);
      continue;
    }
    const notes = s.sets.filter((x) => x.note).map((x) => `Set ${x.set}: ${x.note}`).join("; ");
    const { data, error } = await db
      .from("workout_sessions")
      .insert({ client_id: clientId, plan_id: parsed.meta.planId, date: s.date, planned_session_key: s.sessionKey, status: "completed", notes: [`Imported from the week ${parsed.meta.week} sheet.`, notes].filter(Boolean).join(" "), source: "client_sheet" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    const rows = s.sets.map((x) => ({ session_id: data.id, exercise_id: x.exerciseId, set_number: x.set, weight_lb: x.weightLb, reps: x.reps, rpe: null, is_test: false }));
    const { error: e2 } = await db.from("set_logs").insert(rows);
    if (e2) return { error: e2.message };
    sessions++;
    sets += rows.length;
  }
  revalidateClient(clientId);
  return { error: null, summary: { sessions, sets, skipped, week: parsed.meta.week } };
}

export type CheckoffResult = { ok: true; done: boolean } | { ok: false; error: string };

/**
 * Check a planned workout off (or un-check it). Saved as a completed workout
 * session (source "checkoff") so it counts toward adherence. Workouts logged
 * with sets (imported sheet or session form) stay done; edit them in the
 * training log instead.
 */
export async function toggleWorkoutAction(clientId: string, planId: string, date: string, key: string): Promise<CheckoffResult> {
  const db = createClient();
  const { data: plan } = await db.from("plans").select("id, client_id, status, parameters, training").eq("id", planId).maybeSingle();
  if (!plan || plan.client_id !== clientId || !plan.training) return { ok: false, error: "Plan not found." };
  if (plan.status !== "approved") return { ok: false, error: "Approve the plan before checking off workouts." };
  if (date > todayIn()) return { ok: false, error: "That day hasn't happened yet." };
  const item = plannedItemsForWeek(plan.parameters, plan.training, planWeekOf(plan.parameters.start_date, date)).find((i) => i.date === date && i.key === key);
  if (!item) return { ok: false, error: "That workout isn't scheduled on that day." };

  const { data: existing } = await db.from("workout_sessions").select("id, source, status").eq("client_id", clientId).eq("date", date).eq("planned_session_key", key);
  const rows = (existing ?? []) as { id: string; source: string | null; status: string }[];
  const logged = rows.find((r) => r.source !== "checkoff" && (r.status === "completed" || r.status === "partial"));
  if (logged) return { ok: false, error: "Logged with sets. Edit it in the training log." };
  const checks = rows.filter((r) => r.source === "checkoff");
  if (checks.length) {
    const { error } = await db.from("workout_sessions").delete().in("id", checks.map((r) => r.id));
    if (error) return { ok: false, error: error.message };
    revalidateClient(clientId);
    return { ok: true, done: false };
  }
  const { error } = await db.from("workout_sessions").insert({ client_id: clientId, plan_id: planId, date, planned_session_key: key, status: "completed", duration_min: item.minutes, source: "checkoff" });
  if (error) return { ok: false, error: error.message };
  revalidateClient(clientId);
  return { ok: true, done: true };
}
