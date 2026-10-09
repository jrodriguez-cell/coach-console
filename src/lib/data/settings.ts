import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SETTINGS_DEFAULTS, type AppSettings } from "./settings-defaults";

export { SETTINGS_DEFAULTS, type AppSettings };

export async function getSettings(db: SupabaseClient): Promise<AppSettings> {
  const { data } = await db.from("settings").select("key, value");
  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const obj = <T extends object>(k: keyof AppSettings, d: T): T => ({ ...d, ...((map.get(k) as Partial<T>) ?? {}) });
  return {
    disclaimer: (map.get("disclaimer") as string) || SETTINGS_DEFAULTS.disclaimer,
    task_thresholds: obj("task_thresholds", SETTINGS_DEFAULTS.task_thresholds),
    guardrail_limits: obj("guardrail_limits", SETTINGS_DEFAULTS.guardrail_limits),
    default_deficits: obj("default_deficits", SETTINGS_DEFAULTS.default_deficits),
    uncertainty: obj("uncertainty", SETTINGS_DEFAULTS.uncertainty),
    ai_guidance: typeof map.get("ai_guidance") === "string" ? (map.get("ai_guidance") as string) : "",
  };
}
