"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { saveSessionResultsAction, type ResultsState, type SetInput } from "@/app/actions/entries";
import { SubmitButton } from "./submit-button";
import { useToastOn } from "./toaster";

export interface ResultExercise {
  id: string;
  name: string;
  unit: "reps" | "seconds";
  /** prescribed sets this week */
  sets: number;
  /** e.g. "3 × 8–12 · RPE 7–8" */
  target: string;
  /** last time, e.g. "25 lb × 10 (Sep 28)" */
  last: string | null;
  lastWeight: number | null;
  logged: { set_number: number; weight_lb: number | null; reps: number | null }[];
}

type Row = { weight: string; reps: string };

/**
 * Enter one session's results right on the plan: weight and reps (or seconds
 * for holds) for every set. Empty sets are ignored; saving with everything
 * empty removes the session.
 */
export function SessionResults({ clientId, planId, date, sessionKey, exercises, notes, editable }: { clientId: string; planId: string; date: string; sessionKey: string; exercises: ResultExercise[]; notes: string; editable: boolean }) {
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(
      exercises.map((e) => {
        const n = Math.max(e.sets, ...e.logged.map((l) => l.set_number), 1);
        return [e.id, Array.from({ length: n }, (_, i) => {
          const l = e.logged.find((x) => x.set_number === i + 1);
          return { weight: l?.weight_lb != null ? String(l.weight_lb) : "", reps: l?.reps != null ? String(l.reps) : "" };
        })];
      }),
    ),
  );
  const [state, action] = useFormState<ResultsState, FormData>(saveSessionResultsAction.bind(null, clientId, planId, date, sessionKey), { error: null });
  useToastOn(state.savedAt != null && !state.error, state.sets ? `Saved ${state.sets} ${state.sets === 1 ? "set" : "sets"}` : "Cleared", state.savedAt);

  const set = (id: string, i: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: r[id].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const payload = (): SetInput[] =>
    exercises.flatMap((e) => rows[e.id].map((r, i) => ({ exercise_id: e.id, set_number: i + 1, weight_lb: num(r.weight), reps: num(r.reps), rpe: null, is_test: false })));
  const expected = exercises.reduce((a, e) => a + e.sets, 0);

  return (
    <form action={(fd) => { fd.set("sets", JSON.stringify(payload())); fd.set("expected_sets", String(expected)); return action(fd); }} className="space-y-4">
      {exercises.map((e) => (
        <fieldset key={e.id} disabled={!editable} className="border-t border-fg/10 pt-3 first:border-0 first:pt-0">
          <legend className="sr-only">{e.name}</legend>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold">{e.name}</span>
            <span className="text-xs text-muted">{e.target}</span>
          </div>
          {e.last && <div className="text-xs text-muted">Last time: {e.last}</div>}
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rows[e.id].map((r, i) => (
              <div key={i} className="grid grid-cols-[3.25rem_1fr_1fr] items-center gap-1.5">
                <span className="text-xs text-muted">Set {i + 1}</span>
                <label className="relative">
                  <span className="sr-only">{`${e.name} set ${i + 1} weight (lb)`}</span>
                  <input className="input pr-7" type="number" inputMode="decimal" step="0.5" min={0} value={r.weight} placeholder={e.lastWeight != null ? String(e.lastWeight) : ""} onChange={(ev) => set(e.id, i, { weight: ev.target.value })} />
                  <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">lb</span>
                </label>
                <label className="relative">
                  <span className="sr-only">{`${e.name} set ${i + 1} ${e.unit === "seconds" ? "seconds" : "reps"}`}</span>
                  <input className="input pr-9" type="number" inputMode="numeric" min={0} value={r.reps} onChange={(ev) => set(e.id, i, { reps: ev.target.value })} />
                  <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">{e.unit === "seconds" ? "sec" : "reps"}</span>
                </label>
              </div>
            ))}
          </div>
          {editable && (
            <div className="mt-1.5 flex gap-2">
              <button type="button" className="btn btn-sm" onClick={() => setRows((x) => ({ ...x, [e.id]: [...x[e.id], { weight: x[e.id].at(-1)?.weight ?? "", reps: "" }] }))}>+ Set</button>
              {rows[e.id].length > 1 && <button type="button" className="btn btn-sm" onClick={() => setRows((x) => ({ ...x, [e.id]: x[e.id].slice(0, -1) }))}>− Set</button>}
            </div>
          )}
        </fieldset>
      ))}
      <label className="block">
        <span className="label">Notes (optional)</span>
        <textarea className="input" name="notes" rows={2} defaultValue={notes} disabled={!editable} />
      </label>
      {state.error && <p role="alert" className="note-warn p-2 text-sm">{state.error}</p>}
      {editable ? <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Saving…">Save results</SubmitButton> : <p className="text-xs text-muted">This day hasn&apos;t happened yet.</p>}
    </form>
  );
}
