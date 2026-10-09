import Link from "next/link";
import clsx from "clsx";
import { completeTaskAction, snoozeTaskAction } from "@/app/actions/tasks";
import { Empty } from "./ui";
import { formatDate, todayIn } from "@/lib/dates";
import { shortTaskTitle } from "@/lib/tasks";
import type { TaskRow } from "@/lib/data/types";

const short = (d: string) => formatDate(d).replace(/, \d{4}$/, "");

/**
 * Compact task rows: tick the circle to complete; due date as quiet text
 * (overdue in bold); Send for weekly-plan tasks; snooze tucked in a menu.
 * With `limit`, the rest sit behind "Show N more".
 */
export function TaskList({ tasks, showClient = true, clientNames, clientName, columns = false, limit }: { tasks: TaskRow[]; showClient?: boolean; clientNames?: Record<string, string>; clientName?: string; columns?: boolean; limit?: number }) {
  const today = todayIn();
  if (tasks.length === 0) return <Empty>Nothing open. You&apos;re all caught up.</Empty>;
  // Oldest due first (overdue at the top).
  const sorted = [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const rest = limit ? sorted.slice(limit) : [];
  const row = (t: TaskRow) => {
    const overdue = t.status !== "snoozed" && t.due_date < today;
    return (
      <li key={t.id} className="flex items-start gap-3 py-2.5">
        <form action={completeTaskAction.bind(null, t.id, t.client_id)} className="pt-0.5">
          <button aria-label={`Mark done: ${shortTaskTitle(t.title, clientName)}`} title="Mark done" className="group flex h-6 w-6 items-center justify-center rounded-full border-2 border-fg/40 hover:border-fg hover:bg-fg">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-canvas opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
          </button>
        </form>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">{shortTaskTitle(t.title, clientName)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {t.status === "snoozed" && t.snoozed_until ? `Snoozed until ${short(t.snoozed_until)}` : overdue ? <span className="font-semibold text-fg">Overdue · {short(t.due_date)}</span> : t.due_date === today ? "Due today" : `Due ${short(t.due_date)}`}
            {showClient && t.client_id && clientNames?.[t.client_id] ? <> · <Link href={`/clients/${t.client_id}`}>{clientNames[t.client_id]}</Link></> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {t.rule_key === "send_week" && t.client_id && <Link className="btn btn-sm btn-primary" href={`/clients/${t.client_id}/send?date=${t.due_date}`}>Send</Link>}
          <details className="relative">
            <summary className="btn btn-sm cursor-pointer list-none px-2.5 [&::-webkit-details-marker]:hidden" title="Snooze">Later</summary>
            <div className="absolute right-0 z-20 mt-1 w-36 border border-fg/30 bg-canvas p-1">
              {[["1", "Tomorrow"], ["3", "In 3 days"], ["7", "Next week"]].map(([d, label]) => (
                <form key={d} action={snoozeTaskAction.bind(null, t.id, t.client_id)}>
                  <input type="hidden" name="days" value={d} />
                  <button className="block min-h-[36px] w-full px-2 text-left text-sm hover:bg-fg/[0.06]">{label}</button>
                </form>
              ))}
            </div>
          </details>
        </div>
      </li>
    );
  };
  const listCls = clsx("divide-y divide-fg/10", columns && "lg:grid lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0 lg:[&>li]:border-b lg:[&>li]:border-fg/10");
  return (
    <>
      <ul className={listCls}>{shown.map(row)}</ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none py-2 text-sm text-muted hover:text-fg [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show {rest.length} more</span><span className="hidden group-open:inline">Show less</span></summary>
          <ul className={listCls}>{rest.map(row)}</ul>
        </details>
      )}
    </>
  );
}
