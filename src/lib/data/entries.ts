import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateEntry } from "@/lib/metrics";
import type { MetricDefRow } from "./types";

export interface EntryState {
  error: string | null;
  cellErrors?: Record<string, string>;
  warnings?: Record<string, string>;
  needsConfirm?: boolean;
  saved?: number;
}

export interface EntryInput {
  metric_key: string;
  date: string;
  raw: string;
}

const cell = (e: EntryInput) => `${e.metric_key}|${e.date}`;

/**
 * Validate and save metric entries. Implausible values and replacements of
 * existing entries require explicit confirmation — nothing is overwritten
 * silently.
 */
export async function saveEntries(db: SupabaseClient, clientId: string, entries: EntryInput[], confirmed: boolean): Promise<EntryState> {
  const { data: defsData } = await db.from("metric_definitions").select("*");
  const defs = (defsData ?? []) as MetricDefRow[];
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const rows = entries.filter((e) => e.raw.trim() !== "");
  if (rows.length === 0) return { error: null, saved: 0 };
  const metricIds = Array.from(new Set(rows.map((r) => byKey.get(r.metric_key)?.id).filter(Boolean))) as string[];
  const { data: existingData } = await db.from("metric_entries").select("metric_id, date, value_num, value_text").eq("client_id", clientId).in("metric_id", metricIds).order("date");
  const existing = existingData ?? [];
  const cellErrors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const upserts: Record<string, unknown>[] = [];
  for (const e of rows) {
    const def = byKey.get(e.metric_key);
    if (!def) {
      cellErrors[cell(e)] = "Unknown metric.";
      continue;
    }
    const same = existing.find((x) => x.metric_id === def.id && x.date === e.date) ?? null;
    // previous = latest entry before this date, including other rows in this batch
    const batchPrev = rows.filter((r) => r.metric_key === e.metric_key && r.date < e.date && r.raw.trim() !== "").map((r) => ({ date: r.date, value_num: Number(r.raw) }));
    const dbPrev = existing.filter((x) => x.metric_id === def.id && x.date < e.date).map((x) => ({ date: x.date, value_num: x.value_num != null ? Number(x.value_num) : null }));
    const prev = [...dbPrev, ...batchPrev].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
    const v = validateEntry({
      metric: def,
      raw: e.raw,
      date: e.date,
      previous: prev,
      existing: same ? { value_num: same.value_num != null ? Number(same.value_num) : null, value_text: same.value_text } : null,
      confirmed,
    });
    if (v.errors.length) cellErrors[cell(e)] = v.errors.join(" ");
    else if (v.warnings.length && !confirmed) warnings[cell(e)] = v.warnings.join(" ");
    else upserts.push({ client_id: clientId, metric_id: def.id, date: e.date, value_num: v.value_num, value_text: v.value_text, source: "coach_entered" });
  }
  if (Object.keys(cellErrors).length) return { error: "Fix the highlighted values.", cellErrors, warnings };
  if (Object.keys(warnings).length) return { error: null, warnings, needsConfirm: true };
  const { error } = await db.from("metric_entries").upsert(upserts, { onConflict: "client_id,metric_id,date" });
  if (error) return { error: error.message };
  return { error: null, saved: upserts.length };
}

