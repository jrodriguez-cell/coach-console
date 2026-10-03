"use client";
import { useFormState } from "react-dom";
import { generatePlanAction, type ActionState } from "@/app/actions/plans";
import { SubmitButton } from "./submit-button";

export function GenerateForm({ clientId, fromPlanId, defaults, label = "Generate draft plan", compact = false }: { clientId: string; fromPlanId?: string; defaults?: { start_date?: string; weeks?: number; days_per_week?: number }; label?: string; compact?: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(generatePlanAction.bind(null, clientId), { error: null });
  return (
    <form action={action} className="space-y-2">
      {fromPlanId && <input type="hidden" name="from_plan_id" value={fromPlanId} />}
      {!compact && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label><span className="label">Start date</span><input className="input" type="date" name="start_date" defaultValue={defaults?.start_date} /></label>
          <label><span className="label">Weeks</span><input className="input" type="number" name="weeks" min={4} max={24} defaultValue={defaults?.weeks ?? 12} /></label>
          <label><span className="label">Days/week</span><input className="input" type="number" name="days_per_week" min={2} max={6} defaultValue={defaults?.days_per_week} placeholder="from intake" /></label>
        </div>
      )}
      <p className="text-xs text-stone">Numbers come from the deterministic calculators; Claude only picks exercises from the filtered library and writes short notes. Output is validated before it is saved as a DRAFT.</p>
      {state.error && (
        <div className="note-alert p-2 text-sm">
          {state.error}
          {state.details && state.details.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs">{state.details.slice(0, 8).map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      )}
      <SubmitButton className="btn-primary" pendingText="Drafting… (≈30–60 s)">{label}</SubmitButton>
    </form>
  );
}
