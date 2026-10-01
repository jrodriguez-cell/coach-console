import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTasks, upcomingKeyDates, type KeyDate } from "@/lib/tasks";
import { loadProgressData, summarize, toSnapshot, type ProgressSummary } from "./progress-data";
import type { AppSettings } from "./settings";
import type { ClientRow } from "./types";

/**
 * Run the rule engine for every client and upsert tasks idempotently
 * (unique client_id + rule_key + due_date; existing rows are never touched,
 * so done/snoozed tasks stay that way). Auto-resolves tasks whose condition
 * cleared (e.g. the weigh-in was logged).
 */
export async function runTaskEngine(db: SupabaseClient, settings: AppSettings, today: string, hourNow: number): Promise<{ keyDates: KeyDate[]; summaries: Map<string, ProgressSummary>; clients: ClientRow[] }> {
  const { data: clients } = await db.from("clients").select("*").in("status", ["prospect", "active", "completed"]);
  const list = (clients ?? []) as ClientRow[];
  const data = await loadProgressData(db, list);
  const create: Record<string, unknown>[] = [];
  const keyDates: KeyDate[] = [];
  const summaries = new Map<string, ProgressSummary>();
  for (const c of list) {
    const d = data.get(c.id)!;
    const s = summarize(d, today, settings.task_thresholds);
    summaries.set(c.id, s);
    const snap = toSnapshot(d, s);
    const out = generateTasks(snap, today, hourNow, settings.task_thresholds);
    for (const t of out.create) create.push({ ...t, source: "rule", status: "open" });
    for (const r of out.resolve) {
      await db.from("tasks").update({ status: "done" }).eq("client_id", r.client_id).eq("rule_key", r.rule_key).eq("due_date", r.due_date).eq("status", "open");
    }
    keyDates.push(...upcomingKeyDates(snap, today, 7));
  }
  if (create.length) {
    const { error } = await db.from("tasks").upsert(create, { onConflict: "client_id,rule_key,due_date", ignoreDuplicates: true });
    if (error) throw error;
  }
  // Wake snoozed tasks whose snooze has elapsed.
  await db.from("tasks").update({ status: "open", snoozed_until: null }).eq("status", "snoozed").lte("snoozed_until", today);
  return { keyDates: keyDates.sort((a, b) => a.date.localeCompare(b.date)), summaries, clients: list };
}
