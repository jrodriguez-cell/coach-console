import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibExercise, LibFood } from "@/lib/plan-types";
import { EXERCISES } from "@/data/exercises";

/**
 * Add any exercises from the built-in library (src/data/exercises.ts) that the
 * database doesn't have yet, e.g. new skill progressions, with their
 * regression/progression links. Existing rows are left untouched.
 */
export async function ensureExerciseLibrary(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.from("exercises").select("id, slug");
  if (error) throw error;
  const have = new Set((data ?? []).map((r) => r.slug));
  const missing = EXERCISES.filter((e) => !have.has(e.slug));
  if (!missing.length) return 0;
  const ins = await db.from("exercises").insert(missing.map(({ regression: _r, progression: _p, ...e }) => e));
  if (ins.error) throw ins.error;
  const { data: all } = await db.from("exercises").select("id, slug");
  const idOf = new Map((all ?? []).map((r) => [r.slug, r.id]));
  for (const e of missing) {
    if (!e.regression && !e.progression) continue;
    await db.from("exercises").update({ regression_id: e.regression ? idOf.get(e.regression) ?? null : null, progression_id: e.progression ? idOf.get(e.progression) ?? null : null }).eq("slug", e.slug);
  }
  return missing.length;
}

export async function loadExercises(db: SupabaseClient): Promise<LibExercise[]> {
  const { data, error } = await db.from("exercises").select("id, slug, name, pattern, primary_muscles, equipment, contraindications, regression_id, progression_id, is_compound").order("name");
  if (error) throw error;
  return (data ?? []) as LibExercise[];
}

export async function loadFoods(db: SupabaseClient): Promise<LibFood[]> {
  const { data, error } = await db.from("foods").select("id, slug, name, category, per_100g_cal, per_100g_protein, per_100g_carb, per_100g_fat, household_unit, household_g, allergens, dietary_tags").order("name");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    ...f,
    per_100g_cal: Number(f.per_100g_cal),
    per_100g_protein: Number(f.per_100g_protein),
    per_100g_carb: Number(f.per_100g_carb),
    per_100g_fat: Number(f.per_100g_fat),
    household_g: Number(f.household_g),
  })) as LibFood[];
}
