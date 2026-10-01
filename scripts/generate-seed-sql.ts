/**
 * Writes supabase/seed.sql: exercise + food libraries, core metrics and
 * default settings as plain SQL (for pasting into the Supabase SQL editor
 * instead of running `npm run seed`). Idempotent.
 *
 *   npx tsx scripts/generate-seed-sql.ts
 */
import { writeFileSync } from "node:fs";
import { EXERCISES } from "../src/data/exercises";
import { FOODS } from "../src/data/foods";
import { CORE_METRICS } from "../src/config/metrics";
import { SETTINGS_DEFAULTS } from "../src/lib/data/settings-defaults";

const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const out: string[] = ["-- Coach Console seed data. Safe to re-run.", "begin;", ""];
out.push(`-- First sign-in claims the trainer account (no-op if it already exists)${`\n-- The first account to sign in becomes the trainer (only if no trainer exists yet).\ncreate or replace function claim_trainer() returns boolean\nlanguage plpgsql security definer set search_path = public as $$\nbegin\n  if auth.uid() is null then return false; end if;\n  if exists (select 1 from app_owner where user_id = auth.uid()) then return true; end if;\n  if exists (select 1 from app_owner) then return false; end if;\n  insert into app_owner (user_id) values (auth.uid());\n  return true;\nend $$;\nrevoke all on function claim_trainer() from public;\ngrant execute on function claim_trainer() to authenticated;\n`}`);
out.push("-- Exercise library");
out.push(`insert into exercises (slug, name, pattern, primary_muscles, equipment, contraindications, is_compound) values\n${EXERCISES.map((e) => `(${q(e.slug)}, ${q(e.name)}, ${q(e.pattern)}, ${arr(e.primary_muscles)}, ${arr(e.equipment)}, ${arr(e.contraindications)}, ${e.is_compound})`).join(",\n")}\non conflict (slug) do update set name = excluded.name, pattern = excluded.pattern, primary_muscles = excluded.primary_muscles, equipment = excluded.equipment, contraindications = excluded.contraindications, is_compound = excluded.is_compound;`);
out.push("", "-- Regression / progression links");
out.push(`update exercises e set regression_id = r.id, progression_id = p.id from (values\n${EXERCISES.map((e) => `(${q(e.slug)}, ${q(e.regression)}, ${q(e.progression)})`).join(",\n")}\n) as l(slug, reg, prog) left join exercises r on r.slug = l.reg left join exercises p on p.slug = l.prog where e.slug = l.slug;`);
out.push("", "-- Food library (per 100 g)");
out.push(`insert into foods (slug, name, category, per_100g_cal, per_100g_protein, per_100g_carb, per_100g_fat, household_unit, household_g, household_portion_text, allergens, dietary_tags) values\n${FOODS.map((f) => `(${q(f.slug)}, ${q(f.name)}, ${q(f.category)}, ${f.per_100g_cal}, ${f.per_100g_protein}, ${f.per_100g_carb}, ${f.per_100g_fat}, ${q(f.household_unit)}, ${f.household_g}, ${q(f.household_portion_text)}, ${arr(f.allergens)}, ${arr(f.dietary_tags)})`).join(",\n")}\non conflict (slug) do update set name = excluded.name, category = excluded.category, per_100g_cal = excluded.per_100g_cal, per_100g_protein = excluded.per_100g_protein, per_100g_carb = excluded.per_100g_carb, per_100g_fat = excluded.per_100g_fat, household_unit = excluded.household_unit, household_g = excluded.household_g, household_portion_text = excluded.household_portion_text, allergens = excluded.allergens, dietary_tags = excluded.dietary_tags;`);
out.push("", "-- Core / starter metrics (existing rows are left as you edited them)");
const ruleKeys = ["weight_lb", "adherence_pct", "energy_1_10", "calories", "protein_g"];
for (const m of CORE_METRICS) {
  out.push(`insert into metric_definitions (key, label, type, unit, frequency, applies_to, is_core, required, active, show_in_charts, used_by_task_rule, display_order) values (${q(m.key)}, ${q(m.label)}, ${q(m.type)}, ${q(m.unit)}, ${q(m.frequency)}, array['all']::text[], ${m.is_core}, ${m.required}, ${m.active}, ${m.show_in_charts}, ${ruleKeys.includes(m.key)}, ${m.display_order}) on conflict (key) do nothing;`);
}
out.push("", "-- Default settings (existing values are kept)");
for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) out.push(`insert into settings (key, value) values (${q(k)}, ${j(v)}) on conflict (key) do nothing;`);
out.push("", "commit;", "", `select (select count(*) from exercises) as exercises, (select count(*) from foods) as foods, (select count(*) from metric_definitions) as metrics, (select count(*) from settings) as settings;`, "");
writeFileSync("supabase/seed.sql", out.join("\n"));
console.log(`wrote supabase/seed.sql (${EXERCISES.length} exercises, ${FOODS.length} foods, ${CORE_METRICS.length} metrics)`);
