"use client";
import { useFormState } from "react-dom";
import { approvePlanAction, editPlanAction, saveOverrideAction, type ActionState } from "@/app/actions/plans";
import { SubmitButton } from "./submit-button";
import { useToastOn } from "./toaster";

function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <div className="mt-2 note-alert p-2 text-sm">
          {state.error}
          {state.details && <ul className="mt-1 list-disc pl-4">{state.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      )}
      {state.ok && state.changes && (
        <div className="mt-2 note-info p-2 text-sm">
          {state.changes.length === 0 ? (
            "Saved. Energy model and targets recomputed — no key numbers changed."
          ) : (
            <>
              <div className="font-medium">Saved. Energy model and targets recomputed:</div>
              <table className="mt-1 text-xs">
                <tbody>
                  {state.changes.map((c) => (
                    <tr key={c.label}><td className="pr-3">{c.label}</td><td className="pr-2">{c.before}</td><td className="pr-2">→</td><td className="font-semibold">{c.after}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Any plan edit: hidden `op` plus fields; shows what changed after recompute. */
export function PlanEditForm({ planId, op, children, submitLabel = "Save", className }: { planId: string; op: string; children: React.ReactNode; submitLabel?: string; className?: string }) {
  const [state, action] = useFormState<ActionState, FormData>(editPlanAction.bind(null, planId), { error: null });
  useToastOn(Boolean(state.ok), "Saved", state);
  return (
    <form action={action} className={className}>
      <input type="hidden" name="op" value={op} />
      {children}
      <SubmitButton className="btn-sm btn-primary" pendingText="Recomputing…">{submitLabel}</SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function OverrideForm({ planId, ruleKey }: { planId: string; ruleKey: string }) {
  const [state, action] = useFormState<ActionState, FormData>(saveOverrideAction.bind(null, planId), { error: null });
  useToastOn(Boolean(state.ok), "Override recorded", state);
  if (state.ok) return <span className="text-xs text-ok">Override recorded.</span>;
  return (
    <form action={action} className="mt-1 flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="rule_key" value={ruleKey} />
      <input className="input text-xs" name="reason" placeholder="Override reason (required)" required />
      <SubmitButton className="btn-sm">Record override</SubmitButton>
      {state.error && <span className="text-xs text-alert">{state.error}</span>}
    </form>
  );
}

export function ApproveForm({ planId }: { planId: string }) {
  const [state, action] = useFormState<ActionState, FormData>((prev) => approvePlanAction(planId, prev), { error: null });
  useToastOn(Boolean(state.ok), "Plan approved", state);
  return (
    <form action={action}>
      <SubmitButton className="btn-primary" pendingText="Checking…" confirm="Approve this plan? There is no sending to clients in v1 — exports are for you to share manually.">Approve</SubmitButton>
      {state.ok && <span className="ml-2 text-sm text-ok">Approved.</span>}
      <Result state={state} />
    </form>
  );
}
