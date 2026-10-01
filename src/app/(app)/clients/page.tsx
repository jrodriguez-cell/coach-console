import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Empty } from "@/components/ui";
import { goalLabel, STATUS_TONE } from "@/lib/labels";
import { daysBetween, formatDate, todayIn } from "@/lib/dates";
import { activeReferOutFlags, blockedSections, REFER_OUT_FLAGS } from "@/lib/intake";
import type { ClientRow, IntakeRow, PlanRow, ReferralRow } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: { status?: string } }) {
  const db = createClient();
  const today = todayIn();
  const [{ data: clients }, { data: intakes }, { data: plans }, { data: clearances }, { data: refs }, { data: cps }] = await Promise.all([
    db.from("clients").select("*").order("name"),
    db.from("intakes").select("client_id, parq_flagged, refer_out_flags, submitted_at").order("submitted_at", { ascending: false }),
    db.from("plans").select("id, client_id, status, version, parameters").neq("status", "archived").order("version", { ascending: false }),
    db.from("clearances").select("client_id, status, created_at").order("created_at", { ascending: false }),
    db.from("referrals").select("client_id, flag, handled_note"),
    db.from("checkpoints").select("client_id, due_date, kind, week, completed_at").is("completed_at", null).gte("due_date", today).order("due_date"),
  ]);
  const filter = searchParams.status ?? "all";
  const rows = ((clients ?? []) as ClientRow[]).filter((c) => filter === "all" || c.status === filter);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Clients</h1>
        <Link href="/clients/new" className="btn btn-primary">New client</Link>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 text-sm capitalize sm:mx-0 sm:flex-wrap sm:px-0">
        {["all", "prospect", "active", "paused", "completed"].map((s) => (
          <Link key={s} href={`/clients?status=${s}`} className={`btn btn-sm shrink-0 ${filter === s ? "btn-primary" : ""}`}>{s}</Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>No clients yet.</Empty>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr><th>Name</th><th>Status</th><th>Goal</th><th>Week</th><th>Next key date</th><th>Flags</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const intake = (intakes ?? []).find((i) => i.client_id === c.id) as Pick<IntakeRow, "parq_flagged" | "refer_out_flags"> | undefined;
                const plansFor = ((plans ?? []) as Pick<PlanRow, "id" | "client_id" | "status" | "parameters">[]).filter((p) => p.client_id === c.id);
                const plan = plansFor.find((p) => p.status === "approved") ?? plansFor[0];
                const clr = (clearances ?? []).find((x) => x.client_id === c.id);
                const handled = ((refs ?? []) as ReferralRow[]).filter((r) => r.client_id === c.id);
                const flags = activeReferOutFlags(intake?.refer_out_flags);
                const blocked = blockedSections(intake?.refer_out_flags, handled);
                const next = (cps ?? []).find((x) => x.client_id === c.id);
                const week = plan?.status === "approved" ? Math.floor(daysBetween(plan.parameters.start_date, today) / 7) + 1 : null;
                return (
                  <tr key={c.id}>
                    <td><Link href={`/clients/${c.id}`}>{c.name}</Link></td>
                    <td><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
                    <td>{goalLabel(c.goal_category)}</td>
                    <td>{plan ? (plan.status === "approved" ? (week! < 1 ? `starts ${formatDate(plan.parameters.start_date)}` : `Week ${Math.min(week!, plan.parameters.weeks)} of ${plan.parameters.weeks}`) : <Badge>draft</Badge>) : "—"}</td>
                    <td>{next ? `${formatDate(next.due_date)} · ${next.kind === "review" ? `week ${next.week} checkpoint` : next.kind}` : "—"}</td>
                    <td className="space-x-1">
                      {intake?.parq_flagged && <Badge tone={clr?.status === "received" || clr?.status === "not_required" ? "gray" : "red"}>PAR-Q{clr?.status === "pending" ? ": clearance pending" : ""}</Badge>}
                      {flags.map((f) => (
                        <Badge key={f} tone={[...blocked.nutrition, ...blocked.training].includes(f) ? "red" : "yellow"} title={REFER_OUT_FLAGS[f].hint}>Refer out: {REFER_OUT_FLAGS[f].label}</Badge>
                      ))}
                      {!intake && <Badge tone="blue">intake needed</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
