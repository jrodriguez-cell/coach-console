"use client";
import { Fragment, useState, useTransition } from "react";
import { logSessionAction, type SetInput } from "@/app/actions/entries";
import type { EntryState } from "@/lib/data/entries";
import { useToastOn } from "./toaster";

interface SessionOption {
  key: string;
  name: string;
  exercises: { id: string; name: string; sets: number }[];
}

export function SessionForm({ clientId, planId, sessions, library }: { clientId: string; planId: string | null; sessions: SessionOption[]; library: { id: string; name: string }[] }) {
  const [key, setKey] = useState(sessions[0]?.key ?? "");
  const [sets, setSets] = useState<SetInput[]>(() => initialSets(sessions[0]));
  const [state, setState] = useState<EntryState>({ error: null });
  useToastOn(state.saved != null && !state.error, "Session saved", state);
  const [pending, start] = useTransition();
  const names = new Map(library.map((e) => [e.id, e.name]));

  function initialSets(s?: SessionOption): SetInput[] {
    return (s?.exercises ?? []).flatMap((e) => Array.from({ length: Math.max(1, e.sets) }, (_, i) => ({ exercise_id: e.id, set_number: i + 1, weight_lb: null, reps: null, rpe: null, is_test: false })));
  }
  const update = (i: number, patch: Partial<SetInput>) => setSets((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        fd.set("sets", JSON.stringify(sets));
        fd.set("planned_session_key", key);
        if (planId) fd.set("plan_id", planId);
        start(async () => setState(await logSessionAction(clientId, state, fd)));
      }}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <label className="col-span-2 md:col-span-1"><span className="label">Date</span><input className="input" type="date" name="date" defaultValue={new Date().toLocaleDateString("en-CA")} /></label>
        <label className="col-span-2 md:col-span-1"><span className="label">Planned session</span>
          <select className="input" value={key} onChange={(e) => { setKey(e.target.value); setSets(initialSets(sessions.find((s) => s.key === e.target.value))); }}>
            <option value="">(unplanned)</option>
            {sessions.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
        <label><span className="label">Status</span>
          <select className="input" name="status" defaultValue="completed"><option value="completed">Completed</option><option value="partial">Partial</option><option value="missed">Missed</option><option value="rest_swap">Rest swap</option></select>
        </label>
        <label><span className="label">Duration (min)</span><input className="input" type="number" inputMode="numeric" name="duration_min" /></label>
        <label><span className="label">Avg RPE</span><input className="input" type="number" inputMode="decimal" step="0.5" name="avg_rpe" /></label>
      </div>
      <div className="table-wrap"><table className="table table-fixed">
        <colgroup><col className="w-7" /><col /><col /><col /><col className="w-12" /><col className="w-[4.5rem]" /></colgroup>
        <thead><tr><th className="px-1" title="Set">#</th><th className="px-1">Lb</th><th className="px-1">Reps</th><th className="px-1">RPE</th><th className="px-1">Test</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {sets.map((s, i) => (
            <Fragment key={i}>
              {(i === 0 || sets[i - 1].exercise_id !== s.exercise_id || !s.exercise_id) && (
                <tr>
                  <td colSpan={6} className="border-b-0 pb-1 pt-4">
                    {s.exercise_id ? <span className="font-semibold">{names.get(s.exercise_id)}</span> : (
                      <select className="input" value="" aria-label="Exercise" onChange={(e) => update(i, { exercise_id: e.target.value })}><option value="">Choose exercise…</option>{library.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-1 align-middle text-muted">{s.set_number}</td>
                <td className="px-1"><input className="input w-full min-w-0 px-1.5" type="number" inputMode="decimal" step="0.5" aria-label={`Set ${s.set_number} weight`} value={s.weight_lb ?? ""} onChange={(e) => update(i, { weight_lb: num(e.target.value) })} /></td>
                <td className="px-1"><input className="input w-full min-w-0 px-1.5" type="number" inputMode="numeric" aria-label={`Set ${s.set_number} reps`} value={s.reps ?? ""} onChange={(e) => update(i, { reps: num(e.target.value) })} /></td>
                <td className="px-1"><input className="input w-full min-w-0 px-1.5" type="number" inputMode="decimal" step="0.5" aria-label={`Set ${s.set_number} RPE`} value={s.rpe ?? ""} onChange={(e) => update(i, { rpe: num(e.target.value) })} /></td>
                <td className="px-1 text-center align-middle"><input type="checkbox" aria-label="Test set" checked={s.is_test} onChange={(e) => update(i, { is_test: e.target.checked })} /></td>
                <td className="whitespace-nowrap px-0 text-right align-middle">
                  <button type="button" aria-label="Add a set" className="btn btn-sm min-w-[34px] px-0" onClick={() => setSets((x) => [...x.slice(0, i + 1), { ...s, set_number: s.set_number + 1, weight_lb: s.weight_lb, reps: null, rpe: null }, ...x.slice(i + 1)])}>+</button>
                  <button type="button" aria-label="Remove set" className="btn btn-sm ml-1 min-w-[34px] px-0" onClick={() => setSets((x) => x.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table></div>
      <button type="button" className="btn w-full sm:w-auto" onClick={() => setSets((x) => [...x, { exercise_id: "", set_number: 1, weight_lb: null, reps: null, rpe: null, is_test: false }])}>Add exercise</button>
      <label className="block"><span className="label">Notes</span><textarea className="input" name="notes" rows={2} /></label>
      {state.error && <p className="text-sm text-alert">{state.error}</p>}
      {state.saved != null && !state.error && <p className="text-sm text-ok">Session saved.</p>}
      <button className="btn btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "Saving…" : "Save session"}</button>
      <p className="text-xs text-muted">Only sets with weight or reps are saved. Mark a set as a test on retest days; tests anchor baseline vs. latest strength.</p>
    </form>
  );
}
