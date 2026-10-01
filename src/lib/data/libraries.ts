import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibExercise, LibFood } from "@/lib/plan-types";

export async function loadExercises(db: SupabaseClient): Promise<LibExercise[]> {
  const { data, error } = await db.from("exercises").select("id, name, pattern, primary_muscles, equipment, contraindications, regression_id, progression_id, is_compound").order("name");
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
