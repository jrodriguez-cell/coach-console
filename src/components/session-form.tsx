"use client";
import { useState, useTransition } from "react";
import { logSessionAction, type SetInput } from "@/app/actions/entries";
import type { EntryState } from "@/lib/data/entries";

interface SessionOption {
  key: string;
  name: string;
  exercises: { id: string; name: string; sets: number }[];
}

export function SessionForm({ clientId, planId, sessions, library }: { clientId: string; planId: string | null; sessions: SessionOption[]; library: { id: string; name: string }[] }) {
  const [key, setKey] = useState(sessions[0]?.key ?? "");
  const [sets, setSets] = useState<SetInput[]>(() => initialSets(sessions[0]));
  const [state, setState] = useState<EntryState>({ error: null });
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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <label><span className="label">Date</span><input className="input" type="date" name="date" defaultValue={new Date().toLocaleDateString("en-CA")} /></label>
        <label><span className="label">Planned session</span>
          <select className="input" value={key} onChange={(e) => { setKey(e.target.value); setSets(initialSets(sessions.find((s) => s.key === e.target.value))); }}>
            <option value="">(unplanned)</option>
            {sessions.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
        <label><span className="label">Status</span>
          <select className="input" name="status" defaultValue="completed"><option value="completed">Completed</option><option value="partial">Partial</option><option value="missed">Missed</option><option value="rest_swap">Rest swap</option></select>
        </label>
        <label><span className="label">Duration (min)</span><input className="input" type="number" name="duration_min" /></label>
        <label><span className="label">Avg RPE</span><input className="input" type="number" step="0.5" name="avg_rpe" /></label>
      </div>
      <table className="table">
        <thead><tr><th>Exercise</th><th>Set</th><th>Weight (lb)</th><th>Reps</th><th>RPE</th><th>Test</th><th></th></tr></thead>
        <tbody>
          {sets.map((s, i) => (
            <tr key={i}>
              <td>{s.exercise_id ? names.get(s.exercise_id) : (
                <select className="input" value="" onChange={(e) => update(i, { exercise_id: e.target.value })}><option value="">Choose…</option>{library.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              )}</td>
              <td>{s.set_number}</td>
              <td><input className="input w-24" type="number" step="0.5" value={s.weight_lb ?? ""} onChange={(e) => update(i, { weight_lb: num(e.target.value) })} /></td>
              <td><input className="input w-20" type="number" value={s.reps ?? ""} onChange={(e) => update(i, { reps: num(e.target.value) })} /></td>
              <td><input className="input w-20" type="number" step="0.5" value={s.rpe ?? ""} onChange={(e) => update(i, { rpe: num(e.target.value) })} /></td>
              <td><input type="checkbox" checked={s.is_test} onChange={(e) => update(i, { is_test: e.target.checked })} /></td>
              <td>
                <button type="button" className="btn btn-sm" onClick={() => setSets((x) => [...x.slice(0, i + 1), { ...s, set_number: s.set_number + 1, weight_lb: s.weight_lb, reps: null, rpe: null }, ...x.slice(i + 1)])}>+ set</button>
                <button type="button" className="btn btn-sm ml-1" onClick={() => setSets((x) => x.filter((_, j) => j !== i))}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm" onClick={() => setSets((x) => [...x, { exercise_id: "", set_number: 1, weight_lb: null, reps: null, rpe: null, is_test: false }])}>Add exercise</button>
      <label className="block"><span className="label">Notes</span><textarea className="input" name="notes" rows={2} /></label>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.saved != null && !state.error && <p className="text-sm text-green-700">Session saved.</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save session"}</button>
      <p className="text-xs text-slate-500">Only sets with weight or reps are saved. Mark a set as a test on retest days; tests anchor baseline vs. latest strength.</p>
    </form>
  );
}
