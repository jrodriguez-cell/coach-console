import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, Empty } from "@/components/ui";
import { ListFilter } from "@/components/list-filter";
import { CheckinForm, MeasurementsForm, WeighInForm } from "@/components/quick-add";
import { ImportWeekForm } from "@/components/import-week-form";
import { goalLabel } from "@/lib/labels";
import type { ClientRow } from "@/lib/data/types";

export const dynamic = "force-dynamic";

/** Quick log from anywhere: pick a client, then log the common things. */
export default async function QuickLogPage({ searchParams }: { searchParams: { client?: string } }) {
  const db = createClient();
  const { data } = await db.from("clients").select("*").in("status", ["active", "prospect", "paused"]).order("name");
  const clients = (data ?? []) as ClientRow[];
  const client = clients.find((c) => c.id === searchParams.client);

  if (!client) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader eyebrow="Log" title="Who is this for?" />
        {clients.length === 0 ? (
          <Empty>No clients yet. <Link href="/clients/new">Add a client</Link> first.</Empty>
        ) : (
          <>
            {clients.length > 6 && <ListFilter target="log-clients" placeholder="Search clients" noun="clients" />}
            <ul id="log-clients" className="divide-y divide-fg/15 border-y border-fg/15">
              {clients.map((c) => (
                <li key={c.id} data-filter={c.name.toLowerCase()}>
                  <Link href={`/log?client=${c.id}`} className="flex min-h-[56px] items-center justify-between gap-3 py-3 no-underline hover:no-underline">
                    <span>
                      <span className="block font-semibold">{c.name}</span>
                      <span className="text-sm text-muted">{goalLabel(c.goal_category)} · {c.status}</span>
                    </span>
                    <span aria-hidden className="text-muted">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  const quick = [
    { key: "weigh", title: "Weigh-in", open: true, body: <WeighInForm clientId={client.id} /> },
    { key: "check", title: "Weekly check-in", open: false, body: <CheckinForm clientId={client.id} /> },
    { key: "meas", title: "Measurements", open: false, body: <MeasurementsForm clientId={client.id} /> },
    { key: "sheet", title: "Returned workout sheet", open: false, body: <ImportWeekForm clientId={client.id} /> },
  ];
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader back={{ href: "/log", label: "Choose another client" }} eyebrow="Log" title={client.name} />
      <div className="divide-y divide-fg/15 border-y border-fg/15">
        {quick.map((q) => (
          <details key={q.key} open={q.open} className="group">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
              <h2>{q.title}</h2>
              <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="pb-5">{q.body}</div>
          </details>
        ))}
      </div>
      <Card title="More">
        <div className="actions">
          <Link className="btn" href={`/clients/${client.id}/session`}>Log a workout</Link>
          <Link className="btn" href={`/clients/${client.id}/entry`}>Data grid</Link>
          <Link className="btn" href={`/clients/${client.id}`}>Client page</Link>
        </div>
      </Card>
    </div>
  );
}
