"use client";
import { useFormState } from "react-dom";
import { importWeekSheetAction, type ImportState } from "@/app/actions/entries";
import { SubmitButton } from "./submit-button";
import { useToastOn } from "./toaster";
import { formatDate } from "@/lib/dates";

/** Upload the Excel week sheet a client filled in; logs every set. */
export function ImportWeekForm({ clientId }: { clientId: string }) {
  const [state, action] = useFormState<ImportState, FormData>(importWeekSheetAction.bind(null, clientId), { error: null });
  useToastOn(Boolean(state.summary && state.summary.sessions > 0), `Imported ${state.summary?.sets ?? 0} sets`, state);
  return (
    <form action={action} className="space-y-3">
      <p className="muted">When a client sends back their filled-in Excel week sheet, upload it here. Every set they logged is saved to their training history.</p>
      <input className="input py-2 file:mr-3 file:border-0 file:bg-fg file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-canvas" type="file" name="sheet" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Importing…">Import sheet</SubmitButton>
      {state.error && <p className="note-warn p-2 text-sm">{state.error}</p>}
      {state.summary && (
        <p className="note-info p-3 text-sm">
          Week {state.summary.week}: {state.summary.sessions} workout{state.summary.sessions === 1 ? "" : "s"}, {state.summary.sets} sets saved.
          {state.summary.skipped.length > 0 && ` Skipped ${state.summary.skipped.map((d) => formatDate(d)).join(", ")} (already logged).`}
        </p>
      )}
    </form>
  );
}
