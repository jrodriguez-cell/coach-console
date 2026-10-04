import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { runTaskEngine } from "@/lib/data/task-runner";
import { Card, Empty } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { SubmitButton } from "@/components/submit-button";
import { createTaskAction } from "@/app/actions/tasks";
import { formatDate, hourIn, todayIn, DAY_NAMES, dayOfWeek } from "@/lib/dates";
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

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Today" title={formatDate(today)} meta={`${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"}`} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {workoutsToday.length > 0 && (
            <Card title="Today's workouts" actions={<span className="text-sm text-muted">{workoutsToday.reduce((a, w) => a + w.day.items.filter((i) => i.state).length, 0)}/{workoutsToday.reduce((a, w) => a + w.day.items.length, 0)} done</span>}>
              <div className="divide-y divide-fg/10">
                {workoutsToday.map(({ plan, day }) => (
                  <div key={plan.id} className="py-2 first:pt-0">
                    <Link className="text-sm font-semibold" href={`/clients/${plan.client_id}`}>{names[plan.client_id] ?? "Client"}</Link>
                    <WeekChecklist clientId={plan.client_id} planId={plan.id} days={[day]} today={today} clientName={names[plan.client_id]} hideDayLabel />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {order.length === 0 && <Card><Empty>Nothing needs your attention right now. New tasks appear here as weigh-ins, check-ins and checkpoints come due.</Empty></Card>}
          {order.map((k) => (
            <Card key={k} title={k === "_general" ? "General" : <Link className="title-sm" href={`/clients/${k}`}>{names[k] ?? "Client"}</Link>}>
              <TaskList tasks={groups.get(k)!} showClient={false} clientName={k === "_general" ? undefined : names[k]} />
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card title="Next 7 days">
            {keyDates.length === 0 ? <Empty>No key dates.</Empty> : (
              <ul className="space-y-2 text-sm">
                {keyDates.map((k, i) => (
                  <li key={i} className="border-b border-fg/10 pb-2 last:border-0"><div className="label mb-1">{DAY_NAMES[dayOfWeek(k.date)]} {formatDate(k.date).replace(/, \d{4}$/, "")}</div><Link href={`/clients/${k.client_id}`}>{k.client_name}</Link> · {k.label}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Add a task">
            <form action={createTaskAction} className="space-y-2">
              <input className="input" name="title" placeholder="Task" required />
              <select className="input" name="client_id" defaultValue="">
                <option value="">No client</option>
                {(allClients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input" type="date" name="due_date" defaultValue={today} />
              <SubmitButton className="btn-primary w-full sm:w-auto">Add task</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
