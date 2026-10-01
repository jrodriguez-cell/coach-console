/**
 * Seed the libraries, core metrics, default settings and the trainer account.
 * Idempotent: libraries upsert by slug (trainer-added rows are untouched),
 * metrics and settings are only inserted when missing.
 *
 *   TRAINER_EMAIL=... TRAINER_PASSWORD=... npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { EXERCISES } from "../src/data/exercises";
import { FOODS } from "../src/data/foods";
import { CORE_METRICS } from "../src/config/metrics";
import { SETTINGS_DEFAULTS } from "../src/lib/data/settings-defaults";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)");
const db = createClient(url, key, { auth: { persistSession: false } });

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as NonNullable<T>;
}

async function main() {
  // Exercises: pass 1 rows, pass 2 regression/progression links.
  await must(db.from("exercises").upsert(EXERCISES.map(({ regression: _r, progression: _p, ...e }) => e), { onConflict: "slug" }), "exercises");
  const rows = await must(db.from("exercises").select("id, slug"), "exercise ids");
  const idOf = new Map((rows as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));
  for (const e of EXERCISES) {
    await must(db.from("exercises").update({ regression_id: e.regression ? idOf.get(e.regression) : null, progression_id: e.progression ? idOf.get(e.progression) : null }).eq("slug", e.slug), `links ${e.slug}`);
  }
  console.log(`exercises: ${EXERCISES.length}`);

  await must(db.from("foods").upsert(FOODS, { onConflict: "slug" }), "foods");
  console.log(`foods: ${FOODS.length}`);

  await must(
    db.from("metric_definitions").upsert(
      CORE_METRICS.map(({ min: _a, max: _b, maxDailyChange: _c, ...m }) => ({ ...m, applies_to: ["all"], used_by_task_rule: ["weight_lb", "adherence_pct", "energy_1_10", "calories", "protein_g"].includes(m.key) })),
      { onConflict: "key", ignoreDuplicates: true },
    ),
    "metrics",
  );
  console.log(`metrics: ${CORE_METRICS.length} core/starter`);

  await must(
    db.from("settings").upsert(
      Object.entries(SETTINGS_DEFAULTS).map(([k, v]) => ({ key: k, value: v })),
      { onConflict: "key", ignoreDuplicates: true },
    ),
    "settings",
  );

  // Trainer account (single user; public sign-up should be disabled in Supabase Auth settings).
  const email = process.env.TRAINER_EMAIL;
  if (email) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    let user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      const password = process.env.TRAINER_PASSWORD;
      if (!password) throw new Error("Trainer user not found; set TRAINER_PASSWORD to create it.");
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      user = data.user!;
      console.log("created trainer auth user");
    }
    await must(db.from("app_owner").upsert({ user_id: user.id }), "app_owner");
    console.log("trainer account linked");
  } else {
    console.log("TRAINER_EMAIL not set — skipped trainer account.");
  }
}

main().then(() => console.log("seed complete"), (e) => { console.error(e.message ?? e); process.exit(1); });
