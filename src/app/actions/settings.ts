"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SETTINGS_DEFAULTS } from "@/lib/data/settings";
import { GOAL_CATEGORIES } from "@/config/goal-templates";
import type { MetricDefRow } from "@/lib/data/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const arr = (f: FormData, k: string) => str(f, k).split(",").map((s) => s.trim()).filter(Boolean);

function numbersFrom<T extends Record<string, number | boolean>>(form: FormData, prefix: string, defaults: T): T {
  const out: Record<string, number | boolean> = {};
  for (const [k, d] of Object.entries(defaults)) {
    if (typeof d === "boolean") out[k] = form.get(`${prefix}${k}`) === "on";
    else {
      const v = Number(str(form, `${prefix}${k}`));
      if (!Number.isFinite(v)) throw new Error(`Invalid number for ${k}`);
      out[k] = v;
    }
  }
  return out as T;
}

export async function saveSettingsAction(form: FormData) {
  const db = createClient();
  const disclaimer = str(form, "disclaimer");
  if (disclaimer.length < 40) throw new Error("The disclaimer must be present on every nutrition page and export; keep it meaningful.");
  const limits = numbersFrom(form, "g_", SETTINGS_DEFAULTS.guardrail_limits);
  if (limits.minCalories < 1200) throw new Error("The calorie floor cannot be set below 1,200 kcal/day.");
  if (limits.fatPctBlocked < 15) throw new Error("The fat hard floor cannot be set below 15%.");
  const rows = [
    { key: "disclaimer", value: disclaimer },
    { key: "task_thresholds", value: numbersFrom(form, "t_", SETTINGS_DEFAULTS.task_thresholds) },
    { key: "guardrail_limits", value: limits },
    { key: "default_deficits", value: Object.fromEntries(GOAL_CATEGORIES.map((g) => [g, Number(str(form, `d_${g}`))])) },
    { key: "uncertainty", value: numbersFrom(form, "u_", SETTINGS_DEFAULTS.uncertainty) },
  ];
  const { error } = await db.from("settings").upsert(rows);
  if (error) throw error;
  revalidatePath("/settings");
}

/** The trainer's coaching rules the AI follows when picking exercises. */
export async function saveAiGuidanceAction(form: FormData) {
  const db = createClient();
  const text = str(form, "ai_guidance").slice(0, 4000);
  const { error } = await db.from("settings").upsert({ key: "ai_guidance", value: text }, { onConflict: "key" });
  if (error) throw error;
  revalidatePath("/settings");
}

export async function upsertExerciseAction(form: FormData) {
  const db = createClient();
  const id = str(form, "id");
  const row = {
    name: str(form, "name"),
    pattern: str(form, "pattern"),
    primary_muscles: arr(form, "primary_muscles"),
    equipment: arr(form, "equipment"),
    contraindications: arr(form, "contraindications"),
    regression_id: str(form, "regression_id") || null,
    progression_id: str(form, "progression_id") || null,
    is_compound: form.get("is_compound") === "on",
    video_url: str(form, "video_url") || null,
  };
  if (!row.name || !row.pattern) throw new Error("Name and pattern are required.");
  const { error } = id ? await db.from("exercises").update(row).eq("id", id) : await db.from("exercises").insert(row);
  if (error) throw error;
  revalidatePath("/settings/exercises");
}

export async function upsertFoodAction(form: FormData) {
  const db = createClient();
  const id = str(form, "id");
  const n = (k: string) => {
    const v = Number(str(form, k));
    if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid ${k}`);
    return v;
  };
  const unit = str(form, "household_unit") || "g";
  const g = n("household_g") || 1;
  const row = {
    name: str(form, "name"),
    category: str(form, "category"),
    per_100g_cal: n("per_100g_cal"),
    per_100g_protein: n("per_100g_protein"),
    per_100g_carb: n("per_100g_carb"),
    per_100g_fat: n("per_100g_fat"),
    household_unit: unit,
    household_g: g,
    household_portion_text: `1 ${unit} ≈ ${Math.round(g)} g`,
    allergens: arr(form, "allergens"),
    dietary_tags: arr(form, "dietary_tags"),
  };
  if (!row.name) throw new Error("Name is required.");
  const { error } = id ? await db.from("foods").update(row).eq("id", id) : await db.from("foods").insert(row);
  if (error) throw error;
  revalidatePath("/settings/foods");
}

export async function deleteFoodAction(id: string) {
  const db = createClient();
  const { error } = await db.from("foods").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/settings/foods");
}

// ---------------------------------------------------------------------------
// Metric definitions (every change is logged)
// ---------------------------------------------------------------------------

async function logChange(metricId: string, change: Record<string, unknown>) {
  const db = createClient();
  await db.from("metric_definition_log").insert({ metric_id: metricId, change });
}

export async function createMetricAction(form: FormData) {
  const db = createClient();
  const label = str(form, "label");
  if (!label) throw new Error("Label required.");
  const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
  const { data: last } = await db.from("metric_definitions").select("display_order").order("display_order", { ascending: false }).limit(1);
  const row = {
    key,
    label,
    type: str(form, "type") || "number",
    unit: str(form, "unit") || null,
    frequency: str(form, "frequency") || "weekly",
    applies_to: form.getAll("applies_to").map(String).length ? form.getAll("applies_to").map(String) : ["all"],
    is_core: false,
    required: form.get("required") === "on",
    active: true,
    show_in_charts: form.get("show_in_charts") === "on",
    used_by_task_rule: false,
    display_order: (last?.[0]?.display_order ?? 100) + 10,
  };
  const { data, error } = await db.from("metric_definitions").insert(row).select("id").single();
  if (error) throw error;
  await logChange(data.id, { action: "created", ...row });
  revalidatePath("/settings/metrics");
}

export async function updateMetricAction(metricId: string, form: FormData) {
  const db = createClient();
  const { data: before } = await db.from("metric_definitions").select("*").eq("id", metricId).single();
  const b = before as MetricDefRow;
  const next: Partial<MetricDefRow> = {
    label: str(form, "label") || b.label,
    unit: str(form, "unit") || null,
    frequency: (str(form, "frequency") || b.frequency) as MetricDefRow["frequency"],
    required: form.get("required") === "on",
    show_in_charts: form.get("show_in_charts") === "on",
    active: form.get("active") === "on",
    applies_to: form.getAll("applies_to").map(String).length ? form.getAll("applies_to").map(String) : ["all"],
  };
  if (!b.is_core) next.type = (str(form, "type") || b.type) as MetricDefRow["type"];
  const diff = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((b as unknown as Record<string, unknown>)[k])).map(([k, v]) => [k, { from: (b as unknown as Record<string, unknown>)[k], to: v }]));
  if (Object.keys(diff).length === 0) return;
  const { error } = await db.from("metric_definitions").update(next).eq("id", metricId);
  if (error) throw error;
  await logChange(metricId, { action: "updated", ...diff });
  revalidatePath("/settings/metrics");
}

/** Retire = hide from forms, keep history. Core metrics can be hidden but not deleted. */
export async function retireMetricAction(metricId: string, retire: boolean) {
  const db = createClient();
  const { error } = await db.from("metric_definitions").update({ active: !retire, retired_at: retire ? new Date().toISOString() : null }).eq("id", metricId);
  if (error) throw error;
  await logChange(metricId, { action: retire ? "retired" : "restored" });
  revalidatePath("/settings/metrics");
}

export async function moveMetricAction(metricId: string, direction: "up" | "down") {
  const db = createClient();
  const { data } = await db.from("metric_definitions").select("id, display_order").order("display_order");
  const list = data ?? [];
  const i = list.findIndex((m) => m.id === metricId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  await db.from("metric_definitions").update({ display_order: list[j].display_order }).eq("id", list[i].id);
  await db.from("metric_definitions").update({ display_order: list[i].display_order }).eq("id", list[j].id);
  await logChange(metricId, { action: "reordered", direction });
  revalidatePath("/settings/metrics");
}

// ---------------------------------------------------------------------------
// Client data deletion
// ---------------------------------------------------------------------------

export async function deleteClientAction(form: FormData) {
  const db = createClient();
  const id = str(form, "client_id");
  const { data: c } = await db.from("clients").select("name").eq("id", id).single();
  if (!c) throw new Error("Client not found");
  if (str(form, "confirm_name") !== c.name) throw new Error("Type the client's full name exactly to confirm deletion.");
  // All client-linked rows cascade.
  const { error } = await db.from("clients").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/clients");
  redirect("/settings?deleted=1");
}
