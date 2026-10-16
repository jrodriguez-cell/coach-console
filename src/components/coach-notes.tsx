"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { addCoachNoteAction, resolveCoachNoteAction, type NotesState } from "@/app/actions/plans";
import { MOBILITY, NOTE_KINDS, WEAKNESSES, type NoteKind } from "@/config/coach-notes";
import { CONTRAINDICATION_TAGS } from "@/data/exercises";
import type { CoachNote } from "@/lib/intake";
import { formatDate } from "@/lib/dates";
import { SubmitButton } from "./submit-button";
import { toast } from "./toaster";

const AREA: Record<string, string> = { shoulder: "Shoulder", knee: "Knee", low_back: "Low back", wrist: "Wrist", hip: "Hip", elbow: "Elbow", ankle: "Ankle", neck: "Neck" };
const KIND_LABEL = Object.fromEntries(NOTE_KINDS.map((k) => [k.key, k.label])) as Record<NoteKind, string>;

function summary(n: CoachNote): string {
  if (n.kind === "preference") return `${n.stance === "like" ? "Likes" : "Avoid"} ${n.exercise_name}`;
  if (n.kind === "weakness") return `${WEAKNESSES[n.movement as keyof typeof WEAKNESSES]?.label ?? n.movement}${n.regress ? " · main lift made easier" : ""}`;
  if (n.kind === "mobility") return MOBILITY[n.mobility as keyof typeof MOBILITY]?.label ?? n.mobility ?? "";
  if (n.kind === "pain") return `${AREA[n.area ?? ""] ?? n.area}`;
  return "";
}
const effect = (n: CoachNote) =>
  n.kind === "preference" ? (n.stance === "avoid" ? "Swapped out of the program" : "Favoured on rebuilds")
  : n.kind === "weakness" ? "Corrective work added to sessions that train it"
  : n.kind === "mobility" ? "Drill added at the start of sessions that need it"
  : n.kind === "pain" ? "Exercises that load this area are swapped out"
  : "Shared with the AI on rebuilds";

/**
 * Notes from training sessions that reshape the program: preferences,
 * movement weaknesses, mobility limits, pain. Saving applies them to the
 * current plan; resolving a note undoes what it added.
 */
export function CoachNotes({ clientId, planId, notes, exercises }: { clientId: string; planId: string | null; notes: CoachNote[]; exercises: string[] }) {
  const [kind, setKind] = useState<NoteKind>("weakness");
  const [state, action] = useFormState<NotesState, FormData>(addCoachNoteAction.bind(null, clientId, planId), { error: null });
  const [last, setLast] = useState<NotesState | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.savedAt) {
      toast(state.message ?? "Saved");
      setLast(state);
      formRef.current?.reset();
    }
  }, [state]);
  const active = notes.filter((n) => n.active);
  const resolved = notes.filter((n) => !n.active);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of note">
          {NOTE_KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)} className={clsx("border px-3 py-1.5 text-sm font-semibold", kind === k.key ? "border-fg bg-fg text-canvas" : "border-fg/30 hover:border-fg")}>{k.label}</button>
          ))}
        </div>
        <p className="text-xs text-muted">{NOTE_KINDS.find((k) => k.key === kind)?.hint}</p>

        {kind === "preference" && (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select className="input w-auto" name="stance" defaultValue="avoid" aria-label="Like or avoid"><option value="avoid">Avoid</option><option value="like">Likes</option></select>
            <input className="input" name="exercise_name" list="coach-note-exercises" placeholder="Exercise, e.g. Barbell Back Squat" required />
            <datalist id="coach-note-exercises">{exercises.map((e) => <option key={e} value={e} />)}</datalist>
          </div>
        )}
        {kind === "weakness" && (
          <>
            <select className="input" name="movement" required defaultValue="">
              <option value="" disabled>Which movement?</option>
              {Object.entries(WEAKNESSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="regress" /> Also make the main lift for this movement one step easier</label>
          </>
        )}
        {kind === "mobility" && (
          <select className="input" name="mobility" required defaultValue="">
            <option value="" disabled>Which area?</option>
            {Object.entries(MOBILITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        {kind === "pain" && (
          <select className="input" name="area" required defaultValue="">
            <option value="" disabled>Which area?</option>
            {CONTRAINDICATION_TAGS.map((t) => <option key={t} value={t}>{AREA[t]}</option>)}
          </select>
        )}
        <textarea className="input" name="text" rows={2} placeholder={kind === "other" ? "What did you learn?" : "Details (optional), e.g. knees cave on the way up"} required={kind === "other"} />
        <label className={clsx("flex items-center gap-2 text-sm", !planId && "text-muted")}><input type="checkbox" name="apply" defaultChecked={Boolean(planId)} disabled={!planId} /> Update the current program now</label>
        {state.error && <p role="alert" className="note-warn p-2 text-sm">{state.error}</p>}
        <SubmitButton className="btn-primary" pendingText="Saving…">Save note</SubmitButton>
        {last?.changes && last.changes.length > 0 && (
          <div className="panel text-sm">
            <p className="font-semibold">{last.message}</p>
            <ul className="mt-1 list-disc pl-5">{last.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
      </form>

      <div>
        {active.length === 0 ? <p className="muted">No notes yet. Add what you notice in sessions: preferences, weak spots, tight areas, anything that hurts.</p> : (
          <ul className="divide-y divide-fg/10">
            {active.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="caps">{KIND_LABEL[n.kind]} · {formatDate(n.date).replace(/, \d{4}$/, "")}</div>
                  {summary(n) && <p className="mt-0.5 font-semibold leading-snug">{summary(n)}</p>}
                  {n.text && <p className="text-sm">{n.text}</p>}
                  <p className="text-xs text-muted">{effect(n)}</p>
                </div>
                <button type="button" className="btn btn-sm" disabled={pending} onClick={() => start(async () => {
                  const r = await resolveCoachNoteAction(clientId, planId, n.id);
                  if (r.error) return toast(r.error, "info");
                  toast(r.changes?.length ? `Resolved; ${r.changes.length} program change${r.changes.length === 1 ? "" : "s"} undone` : "Resolved");
                  router.refresh();
                })}>Resolve</button>
              </li>
            ))}
          </ul>
        )}
        {resolved.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Resolved ({resolved.length})</summary>
            <ul className="mt-2 space-y-1.5 text-muted">{resolved.map((n) => <li key={n.id}>{KIND_LABEL[n.kind]}: {[summary(n), n.text].filter(Boolean).join(" · ")} <span className="text-xs">(resolved {n.resolved_at ? formatDate(n.resolved_at).replace(/, \d{4}$/, "") : ""})</span></li>)}</ul>
          </details>
        )}
      </div>
    </div>
  );
}
