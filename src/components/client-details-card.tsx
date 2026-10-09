"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import clsx from "clsx";
import { updateClientDetailsAction, type DetailsState } from "@/app/actions/plans";
import { GOAL_CATEGORIES, GOAL_TEMPLATES, type GoalCategory } from "@/config/goal-templates";
import { CONTRAINDICATION_TAGS } from "@/data/exercises";
import type { IntakeAnswers } from "@/lib/intake";
import { toast } from "./toaster";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EQUIPMENT: Record<string, string> = { commercial_gym: "Full gym", home_basic: "Home (dumbbells, bands, bench)", bodyweight: "Bodyweight only" };
const HISTORY: Record<string, string> = { none: "New to training", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const AREA: Record<string, string> = { shoulder: "Shoulder", knee: "Knee", low_back: "Low back", wrist: "Wrist", hip: "Hip", elbow: "Elbow", ankle: "Ankle", neck: "Neck" };

function Buttons({ update, rebuild }: { update: (fd: FormData) => void; rebuild: (fd: FormData) => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="actions">
      <button className="btn btn-primary" formAction={update} disabled={pending}>{pending ? "Saving…" : "Save & update program"}</button>
      <button className="btn" formAction={rebuild} disabled={pending}>Save & rebuild with AI (new draft)</button>
    </div>
  );
}

/**
 * The client details the program is built from, editable from the plan.
 * "Update" re-fits this program in place (swaps exercises that no longer
 * fit, adds a skill goal named in the goals); "rebuild" drafts a new version.
 */
export function ClientDetailsCard({ planId, answers, purpose, goal }: { planId: string; answers: IntakeAnswers; purpose: string | null; goal: GoalCategory }) {
  const [editing, setEditing] = useState(false);
  const [updState, update] = useFormState<DetailsState, FormData>(updateClientDetailsAction.bind(null, planId, "update"), { error: null });
  const [rbState, rebuild] = useFormState<DetailsState, FormData>(updateClientDetailsAction.bind(null, planId, "rebuild"), { error: null });
  const state = rbState.error ? rbState : updState;
  useEffect(() => {
    if (updState.savedAt) {
      toast(updState.message ?? "Saved");
      setEditing(false);
    }
  }, [updState.savedAt, updState.message]);

  const rows: [string, string][] = [
    ["Goal", `${GOAL_TEMPLATES[goal].label}${answers.primary_goal ? `: ${answers.primary_goal}` : ""}`],
    ["Purpose", purpose || "—"],
    ["Success in 90 days", answers.success_90_days || "—"],
    ["Training", `${answers.training_days_per_week} days/week · ${answers.session_length_min} min${answers.preferred_days.length ? ` · ${answers.preferred_days.map((d) => DAYS[d]).join(" ")}` : ""}`],
    ["Equipment", EQUIPMENT[answers.equipment] ?? answers.equipment],
    ["Experience", HISTORY[answers.training_history] ?? answers.training_history],
    ["Injuries / limits", [answers.injury_areas.map((x) => AREA[x] ?? x).join(", "), answers.injuries_text].filter(Boolean).join(" · ") || "None"],
    ["Likes", answers.exercise_likes || "—"],
    ["Dislikes", answers.exercise_dislikes.join(", ") || "—"],
    ["Weight", `${answers.weight_lb} lb${answers.goal_weight_lb ? ` → goal ${answers.goal_weight_lb} lb` : ""}`],
  ];

  return (
    <section className="card">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2>Client details</h2>
        <button type="button" className="btn btn-sm" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel" : "Edit"}</button>
      </div>
      <p className="muted mb-3">What the program is built from. Change anything and the program follows.</p>

      {!editing ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-2 border-b border-fg/10 pb-2">
              <dt className="caps pt-0.5">{k}</dt><dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><span className="label">Goal type</span>
              <select className="input" name="goal_category" defaultValue={goal}>{GOAL_CATEGORIES.map((g) => <option key={g} value={g}>{GOAL_TEMPLATES[g].label}</option>)}</select>
            </label>
            <label><span className="label">Main goal (their words)</span><input className="input" name="primary_goal" defaultValue={answers.primary_goal} placeholder="e.g. Hold an L-sit" /></label>
            <label className="sm:col-span-2"><span className="label">Purpose</span><input className="input" name="purpose_text" defaultValue={purpose ?? ""} /></label>
            <label className="sm:col-span-2"><span className="label">Success in 90 days</span><input className="input" name="success_90_days" defaultValue={answers.success_90_days} /></label>
            <label><span className="label">Sport or activity</span><input className="input" name="sport_activity" defaultValue={answers.sport_activity} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Weight (lb)</span><input className="input" type="number" step="0.1" name="weight_lb" defaultValue={answers.weight_lb} /></label>
              <label><span className="label">Goal weight (lb)</span><input className="input" type="number" step="0.1" name="goal_weight_lb" defaultValue={answers.goal_weight_lb ?? ""} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Days / week</span><input className="input" type="number" min={2} max={6} name="training_days_per_week" defaultValue={answers.training_days_per_week} /></label>
              <label><span className="label">Session (min)</span><input className="input" type="number" min={20} max={120} name="session_length_min" defaultValue={answers.session_length_min} /></label>
            </div>
            <fieldset>
              <legend className="label">Preferred days</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="preferred_days" value={i} defaultChecked={answers.preferred_days.includes(i)} />{d}</label>)}</div>
            </fieldset>
            <label><span className="label">Equipment</span>
              <select className="input" name="equipment" defaultValue={answers.equipment}>{Object.entries(EQUIPMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label><span className="label">Experience</span>
              <select className="input" name="training_history" defaultValue={answers.training_history}>{Object.entries(HISTORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="label">Injury areas (exercises that load these are avoided)</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{CONTRAINDICATION_TAGS.map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" name="injury_areas" value={t} defaultChecked={answers.injury_areas.includes(t)} />{AREA[t]}</label>)}</div>
            </fieldset>
            <label className="sm:col-span-2"><span className="label">Injury notes</span><input className="input" name="injuries_text" defaultValue={answers.injuries_text} /></label>
            <label><span className="label">Exercise likes</span><input className="input" name="exercise_likes" defaultValue={answers.exercise_likes} /></label>
            <label><span className="label">Dislikes (comma separated)</span><input className="input" name="exercise_dislikes" defaultValue={answers.exercise_dislikes.join(", ")} placeholder="e.g. burpees, lunges" /></label>
            <label className="sm:col-span-2"><span className="label">Cardio preferences</span><input className="input" name="cardio_preferences" defaultValue={answers.cardio_preferences} /></label>
          </div>
          <p className="text-xs text-muted"><b>Update program</b> keeps this plan: it swaps out exercises that no longer fit (equipment, injuries, dislikes) and adds a skill goal named in their goals (e.g. an L-sit). Changing days, session length, experience or goal type needs a <b>rebuild</b>, which drafts a new version for you to approve.</p>
          {state.error && <p role="alert" className="note-warn p-2 text-sm">{state.error}</p>}
          <Buttons update={update} rebuild={rebuild} />
        </form>
      )}

      {!editing && updState.savedAt && (
        <div className={clsx("mt-3 p-3 text-sm", updState.rebuild?.length ? "note-warn" : "panel")}>
          <p className="font-semibold">{updState.message}</p>
          {updState.changes && updState.changes.length > 0 && <ul className="mt-1 list-disc pl-5">{updState.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
          {updState.rebuild && updState.rebuild.length > 0 && (
            <form className="mt-2">
              <p className="mb-2">You changed {updState.rebuild.join(", ")}. Rebuild to restructure the program around it.</p>
              <button className="btn btn-primary btn-sm" formAction={rebuild}>Rebuild with AI (new draft)</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
