"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { saveSessionResultsAction, type SetInput } from "@/app/actions/entries";
import { swapExerciseAction } from "@/app/actions/plans";
import { toast } from "./toaster";

export interface ResultExercise {
  id: string;
  /** display name (with any skill tag) */
  name: string;
  rawName: string;
  slotId: string;
  /** demo video from the exercise library, else a web search */
  videoUrl?: string | null;
  unit: "reps" | "seconds";
  /** prescribed sets this week */
  sets: number;
  /** e.g. "3 × 8–12 · RPE 7–8" */
  target: string;
  repsLabel: string;
  rpe: string;
  rest: number;
  tag: string | null;
  /** last time, e.g. "25 lb × 10 (Sep 28)" */
  last: string | null;
  lastWeight: number | null;
  /** last session's sets, by set number */
  previous: (string | null)[];
  history: { date: string; sets: string }[];
  alternatives: { id: string; name: string }[];
  logged: { set_number: number; weight_lb: number | null; reps: number | null }[];
}

type Row = { weight: string; reps: string; done: boolean };
type Panel = "history" | "notes" | "swap" | null;

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** Rest countdown: play/pause, vibrates and resets at zero. */
function RestTimer({ seconds, startKey }: { seconds: number; startKey: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  useEffect(() => { if (startKey) { setLeft(seconds); setRunning(true); } }, [startKey, seconds]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => {
      if (l <= 1) {
        setRunning(false);
        try { navigator.vibrate?.(300); } catch { /* not supported */ }
        toast("Rest done");
        return seconds;
      }
      return l - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [running, seconds]);
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause rest timer" : "Start rest timer"} className="flex h-10 w-10 items-center justify-center border border-fg/30 hover:border-fg">
        {running ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg> : <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>}
      </button>
      <span className={clsx("text-sm tabular-nums", running && "font-semibold")}>Rest {mmss(running ? left : seconds)}</span>
      {running && <button type="button" className="text-xs text-muted underline" onClick={() => { setRunning(false); setLeft(seconds); }}>Reset</button>}
    </div>
  );
}

function Chip({ onClick, href, active, children }: { onClick?: () => void; href?: string; active?: boolean; children: React.ReactNode }) {
  const cls = clsx("inline-flex min-h-[36px] shrink-0 items-center gap-1.5 border px-3 text-[12px] font-semibold uppercase tracking-[0.08em] no-underline hover:no-underline", active ? "border-fg bg-fg text-canvas" : "border-fg/25 hover:border-fg");
  return href ? <a className={cls} href={href} target="_blank" rel="noreferrer">{children}</a> : <button type="button" className={cls} onClick={onClick}>{children}</button>;
}

/**
 * Log one session the way clients log in a workout app: a card per exercise
 * with its sets (tick, reps, weight, previous), add/delete set, how-to,
 * swap, history, notes and a rest timer. Ticking a set saves the session.
 */
export function SessionResults({ clientId, planId, date, sessionKey, exercises, notes, editable }: { clientId: string; planId: string; date: string; sessionKey: string; exercises: ResultExercise[]; notes: string; editable: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(
      exercises.map((e) => {
        const n = Math.max(e.sets, ...e.logged.map((l) => l.set_number), 1);
        return [e.id, Array.from({ length: n }, (_, i) => {
          const l = e.logged.find((x) => x.set_number === i + 1);
          return { weight: l?.weight_lb != null ? String(l.weight_lb) : "", reps: l?.reps != null ? String(l.reps) : "", done: Boolean(l && (l.reps != null || l.weight_lb != null)) };
        })];
      }),
    ),
  );
  const [exNotes, setExNotes] = useState<Record<string, string>>(() => parseNotes(notes, exercises));
  const firstOpen = exercises.find((e) => !rows[e.id].every((r) => r.done))?.id ?? null;
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(exercises.map((e) => [e.id, e.id === firstOpen])));
  const [panel, setPanel] = useState<Record<string, Panel>>({});
  const [restKey, setRestKey] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();
  const latest = useRef(rows);
  latest.current = rows;

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const payload = (r: Record<string, Row[]>): SetInput[] =>
    exercises.flatMap((e) => r[e.id].map((x, i) => ({ exercise_id: e.id, set_number: i + 1, weight_lb: num(x.weight), reps: num(x.reps), rpe: null, is_test: false })));

  function save(r: Record<string, Row[]> = latest.current, quiet = false) {
    if (!editable) return Promise.resolve();
    const fd = new FormData();
    fd.set("sets", JSON.stringify(payload(r)));
    fd.set("expected_sets", String(exercises.reduce((a, e) => a + e.sets, 0)));
    fd.set("notes", joinNotes(exNotes, exercises));
    return saveSessionResultsAction(clientId, planId, date, sessionKey, { error: null }, fd).then((res) => {
      if (res.error) toast(res.error, "info");
      else if (!quiet) toast(res.sets ? `Saved · ${res.sets} ${res.sets === 1 ? "set" : "sets"}` : "Cleared");
    });
  }

  const setRow = (id: string, i: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: r[id].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  function tick(e: ResultExercise, i: number) {
    const cur = rows[e.id][i];
    let next: Row;
    if (cur.done) next = { ...cur, done: false, reps: "", weight: cur.weight };
    else {
      // Ticking an empty set fills it from last time (or the bottom of the target).
      const prevW = rows[e.id][i - 1]?.weight || (e.lastWeight != null ? String(e.lastWeight) : "");
      const targetLow = (e.repsLabel.match(/\d+/) ?? [""])[0];
      next = { weight: cur.weight || prevW, reps: cur.reps || targetLow, done: true };
      setRestKey((k) => ({ ...k, [e.id]: Date.now() }));
    }
    const updated = { ...rows, [e.id]: rows[e.id].map((x, j) => (j === i ? next : x)) };
    setRows(updated);
    start(() => save(updated, true).then(() => toast(next.done ? `Set ${i + 1} saved` : `Set ${i + 1} cleared`)));
  }

  function swap(e: ResultExercise, toId: string) {
    start(async () => {
      if (editable) await save(latest.current, true);
      const r = await swapExerciseAction(planId, e.slotId, toId);
      if (r.error) return toast(r.error, "info");
      toast(`Swapped to ${r.name}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {exercises.map((e) => {
        const rs = rows[e.id];
        const doneN = rs.filter((r) => r.done).length;
        const isOpen = open[e.id];
        const p = panel[e.id] ?? null;
        const togglePanel = (x: Panel) => setPanel((m) => ({ ...m, [e.id]: m[e.id] === x ? null : x }));
        const alts = e.alternatives.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()));
        return (
          <section key={e.id} className="border border-fg/20 bg-fg/[0.03]">
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-3 text-left sm:p-4">
              <span className="min-w-0 flex-1">
                <span className="caps">{e.tag ?? "Straight set"}</span>
                <span className="mt-1 block text-[15px] font-semibold leading-snug">{e.rawName}</span>
                <span className="mt-0.5 block text-sm text-muted">{e.repsLabel} · RPE {e.rpe}</span>
              </span>
              <span className={clsx("shrink-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]", doneN >= e.sets ? "bg-fg text-canvas" : "border border-fg/30")}>{doneN ? `${doneN}/${rs.length}` : rs.length} sets</span>
              <svg viewBox="0 0 24 24" className={clsx("mt-1 h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </button>

            {isOpen && (
              <div className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4">
                <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
                  {editable && <Chip onClick={() => setRows((x) => ({ ...x, [e.id]: [...x[e.id], { weight: x[e.id].at(-1)?.weight ?? "", reps: "", done: false }] }))}>+ Add set</Chip>}
                  <Chip href={e.videoUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.rawName} exercise how to`)}`}>▶ How to</Chip>
                  {e.alternatives.length > 0 && <Chip active={p === "swap"} onClick={() => togglePanel("swap")}>⇄ Swap</Chip>}
                  <Chip active={p === "history"} onClick={() => togglePanel("history")}>History</Chip>
                  <Chip active={p === "notes"} onClick={() => togglePanel("notes")}>Notes{exNotes[e.id] ? " •" : ""}</Chip>
                  {editable && rs.length > 1 && <Chip onClick={() => { const r = { ...rows, [e.id]: rows[e.id].slice(0, -1) }; setRows(r); start(() => save(r, true)); }}>Delete set</Chip>}
                </div>

                {p === "swap" && (
                  <div className="border border-fg/20 p-3">
                    <div className="caps mb-2">Swap {e.rawName} for</div>
                    <input className="input mb-2" placeholder="Search alternatives" value={filter} onChange={(ev) => setFilter(ev.target.value)} aria-label="Search alternatives" />
                    <ul className="max-h-64 divide-y divide-fg/10 overflow-y-auto">
                      {alts.map((a) => (
                        <li key={a.id}><button type="button" disabled={pending} onClick={() => swap(e, a.id)} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-sm hover:bg-fg/[0.04] disabled:opacity-50"><span>{a.name}</span><span aria-hidden className="text-muted">⇄</span></button></li>
                      ))}
                      {alts.length === 0 && <li className="py-2 text-sm text-muted">No matches.</li>}
                    </ul>
                    <p className="mt-2 text-xs text-muted">Replaces it in this session for the rest of this 4-week block. Logged sets stay in history.</p>
                  </div>
                )}
                {p === "history" && (
                  <div className="border border-fg/20 p-3">
                    <div className="caps mb-2">History · {e.rawName}</div>
                    {e.history.length === 0 ? <p className="text-sm text-muted">No earlier sets logged.</p> : (
                      <ul className="space-y-1 text-sm">{e.history.map((h) => <li key={h.date} className="grid grid-cols-[4.5rem_1fr] gap-2"><span className="text-muted">{h.date}</span><span>{h.sets}</span></li>)}</ul>
                    )}
                  </div>
                )}
                {p === "notes" && (
                  <label className="block">
                    <span className="label">Notes for {e.rawName}</span>
                    <textarea className="input" rows={2} value={exNotes[e.id] ?? ""} onChange={(ev) => setExNotes((n) => ({ ...n, [e.id]: ev.target.value }))} onBlur={() => start(() => save(latest.current, true))} disabled={!editable} placeholder="e.g. seat at 4, felt easy" />
                  </label>
                )}

                <div>
                  <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2 pb-1 text-center">
                    <span />
                    <span className="caps">{e.unit === "seconds" ? "Seconds" : "Reps"}</span>
                    <span className="caps">Weight</span>
                    <span className="caps">Previous</span>
                  </div>
                  <ul className="space-y-1.5">
                    {rs.map((r, i) => (
                      <li key={i} className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2">
                        <button type="button" disabled={!editable} onClick={() => tick(e, i)} aria-pressed={r.done} aria-label={`Set ${i + 1} ${r.done ? "done" : "not done"}`} className={clsx("flex h-9 w-9 items-center justify-center rounded-full border-2", r.done ? "border-fg bg-fg text-canvas" : "border-fg/40")}>
                          {r.done ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg> : <span className="text-xs text-muted">{i + 1}</span>}
                        </button>
                        <input className={clsx("input text-center", r.done && "bg-fg/[0.06]")} type="number" inputMode="numeric" min={0} value={r.reps} disabled={!editable} aria-label={`Set ${i + 1} ${e.unit === "seconds" ? "seconds" : "reps"}`} onChange={(ev) => setRow(e.id, i, { reps: ev.target.value })} />
                        <label className="relative">
                          <span className="sr-only">{`Set ${i + 1} weight (lb)`}</span>
                          <input className={clsx("input pr-7 text-center", r.done && "bg-fg/[0.06]")} type="number" inputMode="decimal" step="0.5" min={0} value={r.weight} disabled={!editable} placeholder={e.lastWeight != null ? String(e.lastWeight) : ""} onChange={(ev) => setRow(e.id, i, { weight: ev.target.value })} />
                          <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">lb</span>
                        </label>
                        <span className="text-center text-sm text-muted">{e.previous[i] ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <RestTimer seconds={e.rest} startKey={restKey[e.id] ?? 0} />
              </div>
            )}
          </section>
        );
      })}
      {editable ? (
        <button type="button" disabled={pending} onClick={() => start(() => save())} className="btn btn-primary w-full sm:w-auto">{pending ? "Saving…" : "Save workout"}</button>
      ) : <p className="text-xs text-muted">This day hasn&apos;t happened yet.</p>}
    </div>
  );
}

// Per-exercise notes are kept in the session's notes as "Exercise: note" lines.
// Other lines (e.g. from an imported sheet) are kept under the "" key.
function parseNotes(text: string, exercises: ResultExercise[]): Record<string, string> {
  const out: Record<string, string> = {};
  const other: string[] = [];
  for (const line of (text ?? "").split("\n")) {
    const e = exercises.find((x) => line.startsWith(`${x.rawName}: `));
    if (e) out[e.id] = line.slice(e.rawName.length + 2);
    else if (line.trim()) other.push(line);
  }
  out[""] = other.join("\n");
  return out;
}
function joinNotes(notes: Record<string, string>, exercises: ResultExercise[]): string {
  return [notes[""] ?? "", ...exercises.filter((e) => notes[e.id]?.trim()).map((e) => `${e.rawName}: ${notes[e.id].trim()}`)].filter(Boolean).join("\n");
}
