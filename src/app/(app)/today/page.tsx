import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { runTaskEngine } from "@/lib/data/task-runner";
import { Card, Empty } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { SubmitButton } from "@/components/submit-button";
import { createTaskAction } from "@/app/actions/tasks";
import { formatDate, hourIn, todayIn, DAY_NAMES, dayOfWeek } from "@/lib/dates";
import type { TaskRow } from "@/lib/data/types";

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
  const order = Array.from(groups.keys()).sort((a, b) => (a === "_general" ? 1 : b === "_general" ? -1 : (names[a] ?? "").localeCompare(names[b] ?? "")));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h1>Today · {formatDate(today)}</h1>
        <span className="muted">{tasks.length} open</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {order.length === 0 && <Card><Empty>Nothing needs your attention right now.</Empty></Card>}
          {order.map((k) => (
            <Card key={k} title={k === "_general" ? "General" : <Link href={`/clients/${k}`}>{names[k] ?? "Client"}</Link>}>
              <TaskList tasks={groups.get(k)!} showClient={k !== "_general"} clientNames={{}} />
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card title="Next 7 days">
            {keyDates.length === 0 ? <Empty>No key dates.</Empty> : (
              <ul className="space-y-1 text-sm">
                {keyDates.map((k, i) => (
                  <li key={i}><b>{DAY_NAMES[dayOfWeek(k.date)]} {formatDate(k.date)}</b> · <Link href={`/clients/${k.client_id}`}>{k.client_name}</Link> — {k.label}</li>
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
              <SubmitButton className="btn-sm btn-primary">Add task</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
