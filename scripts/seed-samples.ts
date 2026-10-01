/**
 * Two sample clients for end-to-end testing: one weight loss (approved plan,
 * four weeks of data) and one performance (draft plan). Plans use the
 * library-default exercise picks so this script needs no Anthropic key;
 * regenerate in the app to get Claude-drafted picks and notes.
 *
 *   npm run seed:samples
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { generatePlan, libraryDefaultSelector, type GeneratorContext } from "../src/lib/generator";
import { addDays, todayIn, weekStart } from "../src/lib/dates";
import { checkpointDate, planEndDate, retestDate } from "../src/lib/tasks";
import { PRESET_BENCHMARKS } from "../src/config/goal-templates";
import { EX_LIB, FOOD_LIB, PERF_INTAKE, WL_INTAKE } from "../src/test/fixtures";
import type { LibExercise, LibFood } from "../src/lib/plan-types";

config({ path: [".env.local", ".env"], quiet: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as NonNullable<T>;
}

async function libraries(): Promise<{ exercises: LibExercise[]; foods: LibFood[] }> {
  const ex = await must(db.from("exercises").select("id, slug, name, pattern, primary_muscles, equipment, contraindications, regression_id, progression_id, is_compound"), "exercises");
  const fd = await must(db.from("foods").select("id, slug, name, category, per_100g_cal, per_100g_protein, per_100g_carb, per_100g_fat, household_unit, household_g, allergens, dietary_tags"), "foods");
  if (!ex.length || !fd.length) throw new Error("Run `npm run seed` first.");
  return {
    exercises: ex as LibExercise[],
    foods: (fd as LibFood[]).map((f) => ({ ...f, per_100g_cal: +f.per_100g_cal, per_100g_protein: +f.per_100g_protein, per_100g_carb: +f.per_100g_carb, per_100g_fat: +f.per_100g_fat, household_g: +f.household_g })),
  };
}

async function main() {
  const today = todayIn();
  const lib = await libraries();
  void EX_LIB;
  void FOOD_LIB;
  const metrics = await must(db.from("metric_definitions").select("id, key"), "metrics");
  const mid = (k: string) => (metrics as { id: string; key: string }[]).find((m) => m.key === k)!.id;

  // ---------------------------------------------------------------- Client A
  const startA = weekStart(addDays(today, -28), 1);
  const a = await must(db.from("clients").insert({ name: "Sample Client A (weight loss)", status: "active", goal_category: "weight_loss", purpose_text: "Lose fat and keep up with my kids", start_date: startA }).select("id").single(), "client A");
  const parqA = [false, false, false, false, false, true, false];
  await must(db.from("intakes").insert({ client_id: a.id, answers: WL_INTAKE, parq_answers: parqA, parq_flagged: true, refer_out_flags: { injury: false, acute_injury: false, medical_condition: false, eating_disorder: false, mental_health: false, notes: "" } }), "intake A");
  await must(db.from("clearances").insert({ client_id: a.id, status: "received", notes: "Old knee sprain, fully rehabbed", exercise_limits: "No max-effort lifts in weeks 1–4", hr_ceiling: 160, rpe_ceiling: 8, activities_to_avoid: "Jumping", requested_at: addDays(startA, -10), received_at: addDays(startA, -3) }), "clearance A");
  const ctxA: GeneratorContext = { goal: "weight_loss", intake: WL_INTAKE, referOut: null, referralsHandled: [], clearance: { status: "received", notes: "Old knee sprain, fully rehabbed", exercise_limits: "No max-effort lifts in weeks 1–4", hr_ceiling: 160, rpe_ceiling: 8, activities_to_avoid: "Jumping" }, ...lib };
  const planA = await generatePlan(ctxA, { start_date: startA, deficit: 500 }, today, libraryDefaultSelector);
  const e = planA.energy!;
  const params = { ...planA.parameters, start_weight_lb: planA.parameters.weight_lb, start_rate_lb_per_week: e.predicted_lb_per_week, start_band_half_width: (e.predicted_high - e.predicted_low) / 2 };
  const pa = await must(
    db.from("plans").insert({ client_id: a.id, version: 1, goal_category: "weight_loss", status: "approved", approved_at: new Date().toISOString(), parameters: params, training: planA.training, nutrition: planA.nutrition, guardrail_flags: planA.guardrail_flags }).select("id").single(),
    "plan A",
  );
  const warns = planA.guardrail_flags.filter((f) => f.status === "warn");
  if (warns.length) await must(db.from("guardrail_overrides").insert(warns.map((w) => ({ plan_id: pa.id, rule_key: w.rule_key, original_value: w.value ?? null, override_value: w.value ?? null, reason: "Sample data: reviewed by trainer" }))), "overrides A");
  await must(db.from("energy_models").insert({ plan_id: pa.id, mode: e.mode, inputs: params, outputs: e, uncertainty_pct: e.uncertainty_pct }), "energy A");
  const pdates = { start_date: startA, weeks: params.weeks, lifting_days: planA.training!.lifting_days };
  const cps = [
    ...params.checkpoint_weeks.map((w) => ({ week: w, kind: "review", due_date: checkpointDate(pdates, w) })),
    ...planA.training!.weeks.filter((w) => w.retest).map((w) => ({ week: w.week, kind: "retest", due_date: retestDate(pdates, w.week) })),
    ...[1, 5, 9].map((w) => ({ week: w, kind: "measurements", due_date: weekStart(startA, w) })),
    { week: params.weeks, kind: "measurements", due_date: planEndDate(pdates) },
  ].map((c) => ({ ...c, client_id: a.id, plan_id: pa.id }));
  await must(db.from("checkpoints").insert(cps), "checkpoints A");
  await must(db.from("benchmarks").insert(PRESET_BENCHMARKS.weight_loss.map((b) => ({ ...b, client_id: a.id, plan_id: pa.id, baseline: b.name === "Body weight" ? 270 : b.name === "Waist" ? 46 : null, target: b.name === "Body weight" ? 250 : b.name === "Waist" ? 42 : b.name === "Weekly adherence" ? 90 : null, target_date: planEndDate(pdates) }))), "benchmarks A");

  // Four weeks of tracked data: weekly weigh-ins, check-ins, measurements, sessions.
  const entries: Record<string, unknown>[] = [];
  const weights = [270, 268.2, 267.4, 266.1, 265.3];
  weights.forEach((w, i) => {
    const d = addDays(startA, i * 7 - 1 < 0 ? 0 : i * 7 - 1);
    entries.push({ client_id: a.id, metric_id: mid("weight_lb"), date: d, value_num: w });
    if (i > 0) {
      entries.push({ client_id: a.id, metric_id: mid("adherence_pct"), date: d, value_num: [0, 90, 85, 92, 88][i] });
      entries.push({ client_id: a.id, metric_id: mid("energy_1_10"), date: d, value_num: [0, 6, 7, 7, 8][i] });
      entries.push({ client_id: a.id, metric_id: mid("sleep_hrs"), date: d, value_num: [0, 6.5, 7, 7, 7.5][i] });
      entries.push({ client_id: a.id, metric_id: mid("cardio_min"), date: d, value_num: [0, 90, 95, 100, 90][i] });
    }
  });
  await must(db.from("metric_entries").upsert(entries, { onConflict: "client_id,metric_id,date" }), "entries A");
  await must(db.from("measurements").insert(["waist", "hips", "chest", "arm"].map((site, i) => ({ client_id: a.id, date: startA, site, value_in: [46, 48, 47, 15][i] }))), "measurements A");
  await must(db.from("contact_log").insert({ client_id: a.id, date: addDays(today, -9), channel: "text", summary: "Checked in on week 3 weigh-in" }), "contact A");
  const t = planA.training!;
  for (let wk = 1; wk <= 4; wk++) {
    const ws = weekStart(startA, wk);
    for (const [i, day] of t.lifting_days.entries()) {
      const date = addDays(ws, (day - new Date(ws + "T00:00:00Z").getUTCDay() + 7) % 7);
      if (date >= today) continue;
      const key = t.rotation[((wk - 1) * t.lifting_days.length + i) % t.rotation.length];
      const session = t.sessions.find((s) => s.key === key)!;
      const sess = await must(db.from("workout_sessions").insert({ client_id: a.id, plan_id: pa.id, date, planned_session_key: key, status: wk === 3 && i === 1 ? "missed" : "completed", source: "sample" }).select("id").single(), "session");
      if (wk === 3 && i === 1) continue;
      const main = session.slots.find((s) => s.role === "main" && s.unit === "reps");
      if (main) {
        const rx = t.weeks[wk - 1].prescriptions[main.id];
        const sets = Array.from({ length: rx?.sets ?? 2 }, (_, n) => ({ session_id: sess.id, exercise_id: main.exercise.id, set_number: n + 1, weight_lb: 40 + wk * 5, reps: rx?.reps_max ?? 12, rpe: 7, is_test: wk === 1 && n === 0 }));
        await must(db.from("set_logs").insert(sets), "sets");
      }
    }
  }
  console.log("Sample Client A (weight loss): approved plan, 4 weeks of data");

  // ---------------------------------------------------------------- Client B
  const b = await must(db.from("clients").insert({ name: "Sample Client B (performance)", status: "prospect", goal_category: "performance", purpose_text: "Run a faster 10K in the spring", start_date: addDays(today, 7) }).select("id").single(), "client B");
  await must(db.from("intakes").insert({ client_id: b.id, answers: PERF_INTAKE, parq_answers: [false, false, false, false, false, false, false], parq_flagged: false, refer_out_flags: { injury: true, acute_injury: false, medical_condition: false, eating_disorder: false, mental_health: false, notes: "Ankle sprain last year; no current pain." } }), "intake B");
  await must(db.from("referrals").insert({ client_id: b.id, flag: "injury", handled_note: "Discussed; client saw a physical therapist last year and is discharged." }), "referral B");
  const planB = await generatePlan({ goal: "performance", intake: PERF_INTAKE, referOut: { injury: true }, referralsHandled: [{ flag: "injury", handled_note: "PT discharge" }], clearance: null, ...lib }, { start_date: addDays(today, 7) }, today, libraryDefaultSelector);
  const pb = await must(db.from("plans").insert({ client_id: b.id, version: 1, goal_category: "performance", status: "draft", parameters: planB.parameters, training: planB.training, nutrition: planB.nutrition, guardrail_flags: planB.guardrail_flags }).select("id").single(), "plan B");
  await must(db.from("energy_models").insert({ plan_id: pb.id, mode: planB.energy!.mode, inputs: planB.parameters, outputs: planB.energy, uncertainty_pct: planB.energy!.uncertainty_pct }), "energy B");
  console.log("Sample Client B (performance): draft plan");
}

main().then(() => console.log("samples seeded"), (e) => { console.error(e.message ?? e); process.exit(1); });
