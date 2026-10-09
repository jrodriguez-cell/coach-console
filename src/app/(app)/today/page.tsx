import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { runTaskEngine } from "@/lib/data/task-runner";
import { Card, Empty } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { SubmitButton } from "@/components/submit-button";
import { createTaskAction } from "@/app/actions/tasks";
import { addDays, formatDate, hourIn, todayIn, DAY_NAMES, dayOfWeek } from "@/lib/dates";
import clsx from "clsx";
import type { PlanRow, TaskRow } from "@/lib/data/types";
import { WeekChecklist } from "@/components/week-checklist";
import { planWeekOf, weekChecklist, type ChecklistDay, type SessionRecord } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const db = createClient();
  const settings = await getSettings(db);
  const today = todayIn();
  const { keyDates, clients } = await runTaskEngine(db, settings, today, hourIn());
  const { data } = await db.from("tasks").select("*").eq("status", "open").lte("due_date", today).order("due_date");
  const tasks = (data ?? []) as TaskRow[];
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const { data: allClients } = await db.from("clients").select("id, name").order("name");
  for (const c of allClients ?? []) names[c.id] = c.name;
  const groups = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const k = t.client_id ?? "_general";
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  // Today's scheduled workouts across clients with an approved plan, to check off.
  const activeIds = new Set(clients.map((c) => c.id));
  const [{ data: livePlans }, { data: todayRecs }] = await Promise.all([
    db.from("plans").select("id, client_id, status, parameters, training").eq("status", "approved"),
    db.from("workout_sessions").select("client_id, date, planned_session_key, status, source").eq("date", today),
  ]);
  const workoutsToday = ((livePlans ?? []) as Pick<PlanRow, "id" | "client_id" | "parameters" | "training">[])
    .filter((p) => p.training && (activeIds.size === 0 || activeIds.has(p.client_id)))
    .map((p) => {
      const week = planWeekOf(p.parameters.start_date, today);
      const recs = ((todayRecs ?? []) as (SessionRecord & { client_id: string })[]).filter((r) => r.client_id === p.client_id);
      const day = weekChecklist(p.parameters, p.training!, week, recs).find((d) => d.date === today);
      return { plan: p, day };
    })
    .filter((x): x is { plan: (typeof x)["plan"]; day: ChecklistDay } => Boolean(x.day && x.day.items.length))
    .sort((a, b) => (names[a.plan.client_id] ?? "").localeCompare(names[b.plan.client_id] ?? ""));
  const order = Array.from(groups.keys()).sort((a, b) => (a === "_general" ? 1 : b === "_general" ? -1 : (names[a] ?? "").localeCompare(names[b] ?? "")));

  // Next 7 days, one column per day (key dates only; tasks and workouts above).
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((date) => ({ date, items: keyDates.filter((k) => k.date === date) }));
  const weekCount = week.reduce((a, d) => a + d.items.length, 0);
  const workoutsDone = workoutsToday.reduce((a, w) => a + w.day.items.filter((i) => i.state).length, 0);
  const workoutsTotal = workoutsToday.reduce((a, w) => a + w.day.items.length, 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const overdueBy = (k: string) => (groups.get(k) ?? []).filter((t) => t.due_date < today).length;
  const overdueCount = tasks.filter((t) => t.due_date < today).length;
  // Clients with the most overdue first, then most tasks; "General" last.
  order.sort((a, b) => (a === "_general" ? 1 : b === "_general" ? -1 : overdueBy(b) - overdueBy(a) || (groups.get(b)!.length - groups.get(a)!.length) || (names[a] ?? "").localeCompare(names[b] ?? "")));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Today"
        title={formatDate(today)}
      />
      {/* At a glance: what today holds. */}
      <dl className="grid grid-cols-3 gap-3 sm:gap-6">
        {[
          { label: "Workouts today", value: workoutsTotal ? `${workoutsDone}/${workoutsTotal}` : "—", sub: workoutsTotal ? "done" : "none scheduled" },
          { label: "Overdue", value: String(overdueCount), sub: overdueCount ? "tasks past due" : "all caught up" },
          { label: "Due today", value: String(tasks.length - overdueCount), sub: weekCount ? `${plural(weekCount, "key date")} this week` : "tasks" },
        ].map((x) => (
          <div key={x.label} className="border-t-2 border-fg pt-2">
            <dt className="caps">{x.label}</dt>
            <dd className="mt-1 text-3xl font-semibold leading-none tabular-nums">{x.value}</dd>
            <dd className="mt-1 text-xs text-muted">{x.sub}</dd>
          </div>
        ))}
      </dl>

      {workoutsToday.length > 0 && (
        <Card title="Today's workouts" actions={<span className="text-sm text-muted">{workoutsDone}/{workoutsTotal} done</span>}>
          <div className={clsx("grid grid-cols-1 gap-x-10", workoutsToday.length > 1 && "sm:grid-cols-2", workoutsToday.length > 2 && "lg:grid-cols-3")}>
            {workoutsToday.map(({ plan, day }) => (
              <div key={plan.id} className="border-t border-fg/10 py-3 first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0">
                <Link className="text-sm font-semibold" href={`/clients/${plan.client_id}`}>{names[plan.client_id] ?? "Client"}</Link>
                <WeekChecklist clientId={plan.client_id} planId={plan.id} days={[day]} today={today} clientName={names[plan.client_id]} hideDayLabel />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title="Tasks"
        actions={
          <details className="group relative">
            <summary className="btn btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">+ Add task</span><span className="hidden group-open:inline">Close</span></summary>
            <form action={createTaskAction} className="panel absolute right-0 z-20 mt-2 grid w-[min(92vw,34rem)] grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
              <input className="input sm:col-span-2" name="title" placeholder="What needs doing?" required />
              <select className="input" name="client_id" defaultValue="">
                <option value="">No client</option>
                {(allClients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input" type="date" name="due_date" defaultValue={today} aria-label="Due date" />
              <SubmitButton className="btn-primary sm:col-span-2">Add task</SubmitButton>
            </form>
          </details>
        }
      >
        {order.length === 0 ? (
          <Empty>Nothing needs your attention right now. Tasks appear here as weigh-ins, check-ins and checkpoints come due.</Empty>
        ) : (
          // One group: its tasks use both columns. Several: one group per column.
          <div className={clsx("grid grid-cols-1 gap-x-10 gap-y-6", order.length > 1 && "lg:grid-cols-2")}>
            {order.map((k) => (
              <section key={k} aria-label={k === "_general" ? "General" : names[k]}>
                <div className="flex items-baseline justify-between gap-3 border-b border-fg/40 pb-1.5">
                  {k === "_general" ? <h3>General</h3> : <Link className="font-semibold no-underline hover:underline" href={`/clients/${k}`}>{names[k] ?? "Client"}</Link>}
                  <span className="caps">{plural(groups.get(k)!.length, "task")}{overdueBy(k) ? ` · ${overdueBy(k)} overdue` : ""}</span>
                </div>
                <TaskList tasks={groups.get(k)!} showClient={false} clientName={k === "_general" ? undefined : names[k]} columns={order.length === 1} limit={order.length === 1 ? 8 : 4} />
              </section>
            ))}
          </div>
        )}
      </Card>

      <Card title="Next 7 days">
        {weekCount === 0 ? <Empty>No weigh-ins, checkpoints or retests coming up.</Empty> : (
          <ol className="divide-y divide-fg/10 lg:grid lg:grid-cols-7 lg:divide-y-0 lg:border-t lg:border-fg/15">
            {week.map((d) => (
              <li key={d.date} className={clsx("py-2.5 lg:min-h-[7rem] lg:border-l lg:border-fg/10 lg:px-2.5 lg:py-3 lg:first:border-l-0", d.items.length === 0 && "hidden lg:block")}>
                <div className={clsx("caps mb-1.5", d.date === today && "text-fg")}>{d.date === today ? "Today" : DAY_NAMES[dayOfWeek(d.date)]} · {formatDate(d.date).replace(/, \d{4}$/, "")}</div>
                {d.items.length === 0 ? <span className="text-sm text-muted">—</span> : (
                  <ul className="space-y-1.5 text-sm">
                    {d.items.map((k, i) => (
                      <li key={i} className="leading-snug"><Link className="font-semibold no-underline hover:underline" href={`/clients/${k.client_id}`}>{k.client_name}</Link><br /><span className="text-muted">{k.label}</span></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
