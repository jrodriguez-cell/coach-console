import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/data/clients";
import { loadMetricDefs } from "@/lib/data/progress-data";
import { Card } from "@/components/ui";
import { EntryGrid } from "@/components/entry-grid";
import { addDays, DAY_NAMES, dayOfWeek, formatDate, sundayOnOrBefore, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function EntryGridPage({ params, searchParams }: { params: { id: string }; searchParams: { mode?: string; n?: string } }) {
  const db = createClient();
  const client = await getClient(db, params.id);
  if (!client) notFound();
  const mode = searchParams.mode === "daily" ? "daily" : "weekly";
  const n = Math.max(2, Math.min(52, Number(searchParams.n ?? (mode === "daily" ? 14 : 8))));
  const today = todayIn();
  const defs = (await loadMetricDefs(db)).filter((m) => m.active && (m.applies_to.includes("all") || m.applies_to.includes(client.goal_category)));
  const cols = defs.filter((m) => (mode === "daily" ? m.frequency === "daily" : m.frequency !== "daily") && m.type !== "text");
  const rows =
    mode === "daily"
      ? Array.from({ length: n }, (_, i) => addDays(today, -i)).map((d) => ({ date: d, label: `${DAY_NAMES[dayOfWeek(d)]} ${formatDate(d).replace(/, \d{4}$/, "")}` }))
      : Array.from({ length: n }, (_, i) => addDays(sundayOnOrBefore(today), -7 * i)).map((d) => ({ date: d, label: `Sun ${formatDate(d).replace(/, \d{4}$/, "")}` }));
  const { data: entries } = await db.from("metric_entries").select("metric_id, date, value_num, value_text").eq("client_id", client.id).in("date", rows.map((r) => r.date));
  const keyById = new Map(defs.map((d) => [d.id, d.key]));
  const initial: Record<string, string> = {};
  for (const e of entries ?? []) {
    const key = keyById.get(e.metric_id);
    if (key) initial[`${key}|${e.date}`] = e.value_text ?? (e.value_num != null ? String(e.value_num) : "");
  }
  return (
    <div className="space-y-4">
      <PageHeader back={{ href: `/clients/${client.id}`, label: client.name }} eyebrow="Enter data" title={client.name} />
      <div className="grid grid-cols-2 border border-bone/30 sm:inline-grid" role="tablist" aria-label="Metric frequency">
        <Link role="tab" aria-selected={mode === "weekly"} className={`display flex min-h-[40px] items-center justify-center px-4 text-[11px] no-underline hover:no-underline ${mode === "weekly" ? "bg-bone text-ink" : "text-stone"}`} href={`?mode=weekly`}>Weekly</Link>
        <Link role="tab" aria-selected={mode === "daily"} className={`display flex min-h-[40px] items-center justify-center px-4 text-[11px] no-underline hover:no-underline ${mode === "daily" ? "bg-bone text-ink" : "text-stone"}`} href={`?mode=daily`}>Daily</Link>
      </div>
      <Card>
        {cols.length === 0 ? <p className="muted">No active {mode} metrics. Configure them in Settings → Metrics.</p> : <EntryGrid clientId={client.id} rows={rows} columns={cols.map((c) => ({ key: c.key, label: c.label, unit: c.unit, type: c.type }))} initial={initial} />}
      </Card>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href={`?mode=${mode}&n=${n * 2}`}>Show more rows</Link>
        <Link href={`/clients/${client.id}/session`}>Log a session (sets)</Link>
      </div>
      <p className="muted">Weekly values are recorded on the Sunday weigh-in date (each row is that week). Measurements, benchmark tests and sessions have their own forms on the client page.</p>
    </div>
  );
}
