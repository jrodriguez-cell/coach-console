"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { toggleWorkoutAction } from "@/app/actions/entries";
import { toast } from "./toaster";
import type { ChecklistDay, ItemState } from "@/lib/schedule";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLabel = (iso: string, today: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return iso === today ? `Today · ${md}` : `${DAY[d.getUTCDay()]} · ${md}`;
};

/**
 * Tap a workout to check it off: it greys out and counts toward adherence.
 * Tap again to undo. Workouts logged with sets (imported sheet, session form)
 * show as logged and can't be unchecked here.
 */
export function WeekChecklist({ clientId, planId, days, today, editable = true, hideEmpty = false, hideDayLabel = false, clientName, columns = false }: { clientId: string; planId: string; days: ChecklistDay[]; today: string; editable?: boolean; hideEmpty?: boolean; hideDayLabel?: boolean; clientName?: string; columns?: boolean }) {
  const [states, setStates] = useState<Record<string, ItemState>>(() => Object.fromEntries(days.flatMap((d) => d.items.map((i) => [`${i.date}|${i.key}`, i.state]))));
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function toggle(date: string, key: string, label: string) {
    const id = `${date}|${key}`;
    const before = states[id];
    if (before === "logged") return toast("Logged with sets. Edit it in the training log.", "info");
    setStates((s) => ({ ...s, [id]: before ? null : "checked" }));
    setBusy(id);
    start(async () => {
      const r = await toggleWorkoutAction(clientId, planId, date, key);
      setBusy(null);
      if (!r.ok) {
        setStates((s) => ({ ...s, [id]: before }));
        toast(r.error, "info");
      } else toast(r.done ? `${clientName ? `${clientName}: ` : ""}${label} done` : "Unchecked");
    });
  }

  const shown = hideEmpty ? days.filter((d) => d.items.length) : days;
  return (
    // `columns`: on wide screens the week reads like a calendar, one column per day.
    <ul className={clsx("divide-y divide-fg/10", columns && "lg:grid lg:grid-cols-7 lg:divide-y-0 lg:border-t lg:border-fg/15")}>
      {shown.map((d) => (
        <li key={d.date} className={clsx(hideDayLabel ? "pt-1" : "py-2.5", !hideDayLabel && d.date === today && "-mx-2 bg-fg/[0.04] px-2", columns && "lg:mx-0 lg:border-l lg:border-fg/10 lg:px-2.5 lg:py-3 lg:first:border-l-0")}>
          {!hideDayLabel && <div className={clsx("caps mb-1.5", d.date === today && "text-fg")}>{dayLabel(d.date, today)}</div>}
          {d.items.length === 0 ? (
            <p className="text-sm text-muted">Rest day</p>
          ) : (
            <ul className="space-y-1">
              {d.items.map((it) => {
                const id = `${it.date}|${it.key}`;
                const st = states[id];
                const done = st != null;
                const future = it.date > today;
                const canToggle = editable && !future && st !== "logged";
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => toggle(it.date, it.key, it.label)}
                      disabled={!canToggle || (pending && busy === id)}
                      aria-pressed={done}
                      className={clsx(
                        "flex min-h-[44px] w-full items-center gap-3 text-left text-sm disabled:cursor-default sm:min-h-[36px]",
                        done && "text-muted",
                      )}
                    >
                      <span aria-hidden className={clsx("flex h-5 w-5 shrink-0 items-center justify-center border", done ? "border-fg bg-fg text-canvas" : future ? "border-fg/20" : "border-fg/50")}>
                        {done && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                      </span>
                      <span className={clsx("flex-1", done && "line-through decoration-fg/30")}>
                        {it.kind === "strength" ? <b className={clsx("font-semibold", done && "font-medium")}>{it.label}</b> : it.label}
                        {it.kind === "strength" && it.minutes ? <span className="text-muted"> · ≈{it.minutes} min</span> : null}
                      </span>
                      {st === "logged" && <span className="caps shrink-0">logged</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
