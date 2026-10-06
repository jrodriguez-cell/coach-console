import Link from "next/link";
import { completeTaskAction, snoozeTaskAction } from "@/app/actions/tasks";
import { Badge, Empty } from "./ui";
import { formatDate, todayIn } from "@/lib/dates";
import { shortTaskTitle } from "@/lib/tasks";
import type { TaskRow } from "@/lib/data/types";

export function TaskList({ tasks, showClient = true, clientNames, clientName, columns = false }: { tasks: TaskRow[]; showClient?: boolean; clientNames?: Record<string, string>; clientName?: string; columns?: boolean }) {
  const today = todayIn();
  if (tasks.length === 0) return <Empty>Nothing open. You&apos;re all caught up.</Empty>;
  return (
    // `columns`: two columns on wide screens so a full-width card stays balanced.
    <ul className={columns ? "divide-y divide-fg/15 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0" : "divide-y divide-fg/15"}>
      {tasks.map((t) => (
        <li key={t.id} className={columns ? "space-y-2.5 py-3 lg:border-b lg:border-fg/15" : "space-y-2.5 py-3"}>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[15px] leading-snug">{shortTaskTitle(t.title, clientName)}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {t.status === "snoozed" ? <span>Snoozed until {formatDate(t.snoozed_until)}</span> : t.due_date < today ? <Badge tone="red">Overdue · {formatDate(t.due_date).replace(/, \d{4}$/, "")}</Badge> : <span>Due {formatDate(t.due_date)}</span>}
              {showClient && t.client_id && clientNames?.[t.client_id] ? <span>{clientNames[t.client_id]}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {t.rule_key === "send_week" && t.client_id && <Link className="btn btn-sm btn-primary" href={`/clients/${t.client_id}/send?date=${t.due_date}`}>Send</Link>}
            <form action={completeTaskAction.bind(null, t.id, t.client_id)}><button className="btn btn-sm">Done</button></form>
            <form action={snoozeTaskAction.bind(null, t.id, t.client_id)} className="flex items-center gap-1">
              <select name="days" aria-label="Snooze for" className="input w-auto min-h-[34px] py-1 text-sm" defaultValue="1">
                <option value="1">1 day</option><option value="3">3 days</option><option value="7">1 week</option>
              </select>
              <button className="btn btn-sm">Snooze</button>
            </form>
            {showClient && t.client_id && <Link className="btn btn-sm" href={`/clients/${t.client_id}`}>Open</Link>}
          </div>
        </li>
      ))}
    </ul>
  );
}
