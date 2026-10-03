"use client";
import { useRef, useTransition } from "react";
import { useFormState } from "react-dom";
import type { EntryState } from "@/lib/data/entries";
import { SubmitButton } from "./submit-button";

type Action = (prev: EntryState, form: FormData) => Promise<EntryState>;

/**
 * Form whose server action may answer "needs confirmation" (implausible
 * value, or an existing entry would be replaced). The warning is shown with
 * the old value and nothing is saved until the trainer confirms.
 */
export function ConfirmableForm({ action, children, submitLabel, className }: { action: Action; children: React.ReactNode; submitLabel: string; className?: string }) {
  const [state, dispatch] = useFormState(action, { error: null });
  const last = useRef<FormData | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        last.current = fd;
        dispatch(fd);
      }}
      className={className}
    >
      {children}
      {state.error && <p className="text-sm text-alert">{state.error}</p>}
      {state.cellErrors && (
        <ul className="text-sm text-alert">
          {Object.entries(state.cellErrors).map(([k, v]) => <li key={k}>{v}</li>)}
        </ul>
      )}
      {state.needsConfirm && state.warnings && (
        <div className="note-warn p-2 text-sm">
          <ul className="list-disc pl-4">
            {Object.entries(state.warnings).map(([k, v]) => <li key={k}>{v}</li>)}
          </ul>
          <button
            type="button"
            className="btn btn-sm mt-2"
            disabled={pending}
            onClick={() => {
              if (!last.current) return;
              const fd = new FormData();
              last.current.forEach((v, k) => fd.append(k, v));
              fd.set("confirmed", "1");
              start(() => dispatch(fd));
            }}
          >
            Confirm and save
          </button>
        </div>
      )}
      {state.saved != null && !state.error && !state.needsConfirm && <p className="text-sm text-ok">Saved.</p>}
      <SubmitButton className="btn-primary btn-sm">{submitLabel}</SubmitButton>
    </form>
  );
}
