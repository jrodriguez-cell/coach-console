import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { loadMetricDefs, loadProgressData } from "@/lib/data/progress-data";
import { Badge, Card, Empty } from "@/components/ui";
import { markReviewedAction } from "@/app/actions/entries";
import { addDays, formatDate, sundayOnOrBefore, todayIn } from "@/lib/dates";
import type { ClientRow } from "@/lib/data/types";

export const dynamic = "force-dynamic";

/** The weekly round: which active clients are missing data this week. */
export default async function WeeklyRoundPage() {
  const db = createClient();
  await getSettings(db);
  const today = todayIn();
  const weekStart = sundayOnOrBefore(today);
  const weekEnd = addDays(weekStart, 6);
  const { data } = await db.from("clients").select("*").eq("status", "active").order("name");
  const clients = (data ?? []) as ClientRow[];
  const [pd, defs, { data: reviews }] = await Promise.all([loadProgressData(db, clients), loadMetricDefs(db), db.from("entry_reviews").select("client_id").eq("week_start", weekStart)]);
  const required = defs.filter((m) => m.active && m.required && m.frequency === "weekly");
  const inWeek = (d: string) => d >= addDays(weekStart, -1) && d <= weekEnd;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Weekly round" title={`Week of ${formatDate(weekStart)}`} />
      <Card>
        {clients.length === 0 ? <Empty>No active clients.</Empty> : (
          <div className="table-wrap"><table className="table table-stack">
            <thead><tr><th>Client</th><th>Missing this week</th><th>Workouts logged</th><th>Reviewed</th><th></th></tr></thead>
            <tbody>
              {clients.map((c) => {
                const d = pd.get(c.id)!;
                const applies = required.filter((m) => m.applies_to.includes("all") || m.applies_to.includes(c.goal_category));
                const missing = applies.filter((m) => !(d.metrics[m.key] ?? []).some((p) => inWeek(p.date)));
                const sessions = d.sessions.filter((s) => inWeek(s.date)).length;
                const scheduled = d.plan?.training?.lifting_days.length ?? 0;
                const reviewed = (reviews ?? []).some((r) => r.client_id === c.id);
                return (
                  <tr key={c.id}>
                    <td data-primary><Link href={`/clients/${c.id}`}>{c.name}</Link></td>
                    <td data-label="Missing">{missing.length === 0 ? <Badge tone="green">complete</Badge> : missing.map((m) => <Badge key={m.id} tone="yellow">{m.label}</Badge>)}</td>
                    <td data-label="Workouts">{sessions} / {scheduled}</td>
                    <td data-label="Reviewed">{reviewed ? <Badge tone="green">reviewed</Badge> : <form action={markReviewedAction.bind(null, c.id, weekStart)}><button className="btn btn-sm">Mark reviewed</button></form>}</td>
                    <td><Link className="btn btn-sm w-full sm:w-auto" href={`/clients/${c.id}/entry`}>Enter data</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
      <p className="muted">Required weekly inputs are set in Settings → Metrics (starter set: weigh-in, adherence %, energy, sleep).</p>
    </div>
  );
}
