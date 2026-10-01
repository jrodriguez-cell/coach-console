"use client";
import { useFormState } from "react-dom";
import { saveCalibrationAction, type CalibrationState } from "@/app/actions/calibration";
import { SubmitButton } from "./submit-button";

export function CalibrationForm({ clientId, checkpointId, recommended, adherence }: { clientId: string; checkpointId: string | null; recommended: { decision: string; adjustment: number }; adherence: number | null }) {
  const [state, action] = useFormState<CalibrationState, FormData>(saveCalibrationAction.bind(null, clientId), { error: null });
  if (state.ok)
    return (
      <div className="rounded border border-green-900 bg-green-950/40 p-3 text-sm text-green-200">
        Decision saved.
        {state.changes && state.changes.length > 0 && (
          <table className="mt-1 text-xs"><tbody>{state.changes.map((c) => <tr key={c.label}><td className="pr-3">{c.label}</td><td className="pr-2">{c.before}</td><td className="pr-2">→</td><td className="font-semibold">{c.after}</td></tr>)}</tbody></table>
        )}
      </div>
    );
  return (
    <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {checkpointId && <input type="hidden" name="checkpoint_id" value={checkpointId} />}
      <label><span className="label">Adherence % (override)</span><input className="input" type="number" name="adherence_pct" min={0} max={100} step="1" placeholder={adherence != null ? `${adherence.toFixed(0)} (computed)` : "required — no data logged"} /></label>
      <label><span className="label">Decision</span>
        <select className="input" name="decision" defaultValue={recommended.decision}>
          <option value="keep">Keep</option>
          <option value="adjust">Adjust calories</option>
          <option value="fix_adherence">Fix adherence (no calorie change)</option>
          <option value="insufficient_data">Insufficient data</option>
        </select>
      </label>
      <label><span className="label">Calorie adjustment (kcal/day, if adjusting)</span><input className="input" type="number" name="applied_adjustment_kcal" defaultValue={recommended.adjustment} /></label>
      <label className="md:col-span-2"><span className="label">Decision note</span><textarea className="input" name="note" rows={2} placeholder="Why (required if the adjustment triggers a guardrail warning)" /></label>
      {state.error && <div className="rounded border border-red-900 bg-red-950/40 p-2 text-sm text-red-300 md:col-span-2">{state.error}{state.details && <ul className="list-disc pl-4">{state.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}</div>}
      <div><SubmitButton className="btn-primary">Save decision</SubmitButton></div>
    </form>
  );
}
