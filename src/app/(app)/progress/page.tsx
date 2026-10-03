import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { loadProgressData, summarize } from "@/lib/data/progress-data";
import { Badge, Card, Empty, fmt } from "@/components/ui";
import { WEIGHT_STATUS_LABEL } from "@/lib/progress";
import { formatDate, todayIn } from "@/lib/dates";
import { activeReferOutFlags } from "@/lib/intake";
import type { ClientRow } from "@/lib/data/types";

export const dynamic = "force-dynamic";

const TONE = { on_track: "green", slightly_behind: "yellow", behind: "red", ahead: "blue", no_data: "gray" } as const;
const SORTS = ["name", "status", "adherence", "last_weigh_in", "last_checkin"] as const;

export default async function ProgressOverview({ searchParams }: { searchParams: { sort?: string; filter?: string } }) {
  const db = createClient();
  const settings = await getSettings(db);
  const today = todayIn();
  const { data } = await db.from("clients").select("*").eq("status", "active");
  const clients = (data ?? []) as ClientRow[];
  const pd = await loadProgressData(db, clients);
  let rows = clients.map((c) => {
    const d = pd.get(c.id)!;
    const s = summarize(d, today, settings.task_thresholds);
    const flags = [...(d.intake?.parq_flagged && d.clearance?.status === "pending" ? ["clearance pending"] : []), ...activeReferOutFlags(d.intake?.refer_out_flags).map((f) => `refer out: ${f.replace("_", " ")}`)];
    return { c, s, flags, status: s.weight?.status ?? "no_data" };
  });
  const filter = searchParams.filter ?? "all";
  if (filter !== "all") rows = rows.filter((r) => (filter === "flagged" ? r.flags.length > 0 || r.s.strengthFlag : r.status === filter));
  const sort = (SORTS as readonly string[]).includes(searchParams.sort ?? "") ? searchParams.sort! : "status";
  const rank = { behind: 0, slightly_behind: 1, ahead: 2, no_data: 3, on_track: 4 } as const;
  rows.sort((a, b) => {
    switch (sort) {
      case "name": return a.c.name.localeCompare(b.c.name);
      case "adherence": return (a.s.adherence14 ?? 999) - (b.s.adherence14 ?? 999);
      case "last_weigh_in": return (a.s.lastWeighIn ?? "").localeCompare(b.s.lastWeighIn ?? "");
      case "last_checkin": return (a.s.lastCheckin ?? "").localeCompare(b.s.lastCheckin ?? "");
      default: return rank[a.status] - rank[b.status];
    }
  });
  const link = (p: Record<string, string>) => `/progress?${new URLSearchParams({ sort, filter, ...p })}`;
  return (
    <div className="space-y-8">
      <PageHeader title="Progress" display meta="Active clients against their plan." />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {["all", "behind", "slightly_behind", "on_track", "ahead", "no_data", "flagged"].map((f) => (
          <Link key={f} href={link({ filter: f })} className={`btn btn-sm shrink-0 ${filter === f ? "btn-primary" : ""}`}>{f.replace("_", " ")}</Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? <Empty>No active clients match.</Empty> : (
          <div className="table-wrap"><table className="table table-stack">
            <thead>
              <tr>
                <th><Link href={link({ sort: "name" })}>Client</Link></th>
                <th>Week</th>
                <th><Link href={link({ sort: "status" })}>Weight vs plan</Link></th>
                <th><Link href={link({ sort: "adherence" })}>14-day adherence</Link></th>
                <th><Link href={link({ sort: "last_weigh_in" })}>Last weigh-in</Link></th>
                <th><Link href={link({ sort: "last_checkin" })}>Last check-in</Link></th>
                <th>Strength</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, s, flags, status }) => (
                <tr key={c.id}>
                  <td data-primary><Link href={`/clients/${c.id}/progress`}>{c.name}</Link></td>
                  <td data-label="Week">{s.meta ? `${s.week} of ${s.meta.weeks}` : "—"}</td>
                  <td data-label="Weight vs plan"><Badge tone={TONE[status]}>{WEIGHT_STATUS_LABEL[status]}</Badge>{s.weight?.deviation != null && <span className="ml-1 text-xs text-muted">{fmt.signed(s.weight.deviation)} lb</span>}</td>
                  <td data-label="Adherence (14 d)">{s.adherence14 != null ? <span className={s.adherence14 < settings.task_thresholds.adherenceLowPct ? "font-semibold text-alert" : ""}>{fmt.pct(s.adherence14)}</span> : "—"}</td>
                  <td data-label="Last weigh-in">{s.lastWeighIn ? formatDate(s.lastWeighIn) : "—"}</td>
                  <td data-label="Last check-in">{s.lastCheckin ? formatDate(s.lastCheckin) : "—"}</td>
                  <td data-label="Strength">{s.strengthFlag ? <Badge tone="red">below {settings.task_thresholds.strengthRetentionPct}%</Badge> : s.lifts.length ? "ok" : "—"}</td>
                  <td data-label="Flags" className="space-x-1">{flags.map((f) => <Badge key={f} tone="red">{f}</Badge>)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
