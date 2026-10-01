import Link from "next/link";
import { completeTaskAction, snoozeTaskAction } from "@/app/actions/tasks";
import { Badge, Empty } from "./ui";
import { formatDate, todayIn } from "@/lib/dates";
import type { TaskRow } from "@/lib/data/types";

export function TaskList({ tasks, showClient = true, clientNames }: { tasks: TaskRow[]; showClient?: boolean; clientNames?: Record<string, string> }) {
  const today = todayIn();
  if (tasks.length === 0) return <Empty>Nothing open.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {t.title}
            <span className="ml-2 text-xs text-slate-500">
              {t.status === "snoozed" ? `snoozed until ${formatDate(t.snoozed_until)}` : t.due_date < today ? <Badge tone="red">overdue · {formatDate(t.due_date)}</Badge> : formatDate(t.due_date)}
              {showClient && t.client_id && clientNames?.[t.client_id] ? ` · ${clientNames[t.client_id]}` : ""}
            </span>
          </span>
          <form action={completeTaskAction.bind(null, t.id, t.client_id)}><button className="btn btn-sm">Done</button></form>
          <form action={snoozeTaskAction.bind(null, t.id, t.client_id)} className="flex gap-1">
            <select name="days" className="input w-auto py-0.5 text-xs" defaultValue="1">
              <option value="1">1 day</option><option value="3">3 days</option><option value="7">1 week</option>
            </select>
            <button className="btn btn-sm">Snooze</button>
          </form>
          {showClient && t.client_id && <Link className="btn btn-sm" href={`/clients/${t.client_id}`}>Open client</Link>}
        </li>
      ))}
    </ul>
  );
}
