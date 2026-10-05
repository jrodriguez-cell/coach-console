"use client";
import { useFormState } from "react-dom";
import { generatePlanAction, type ActionState } from "@/app/actions/plans";
import { FOCUS_AREAS, FOCUS_LABELS, PROGRAM_STYLES, SPLITS, splitDaysLabel, type Focus, type Split } from "@/config/program-styles";
import { SKILL_KEYS, SKILLS, type SkillKey } from "@/config/skills";
import { SubmitButton } from "./submit-button";

export interface ProgramDefaults {
  /** trainer's saved choice; null = automatic */
  split: Split | null | undefined;
  /** what automatic picks for the current inputs, and why */
  auto: { split: Split; reason: string };
  focus: Focus[];
  rotate: boolean;
  session_length_min: number;
  skill: SkillKey | "none" | null | undefined;
  autoSkill: SkillKey | null;
}

export function GenerateForm({ clientId, fromPlanId, defaults, program, label = "Generate draft plan", compact = false }: { clientId: string; fromPlanId?: string; defaults?: { start_date?: string; weeks?: number; days_per_week?: number }; program?: ProgramDefaults; label?: string; compact?: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(generatePlanAction.bind(null, clientId), { error: null });
  return (
    <form action={action} className="space-y-3">
      {fromPlanId && <input type="hidden" name="from_plan_id" value={fromPlanId} />}
      {!compact && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label><span className="label">Start date</span><input className="input" type="date" name="start_date" defaultValue={defaults?.start_date} /></label>
          <label><span className="label">Weeks</span><input className="input" type="number" name="weeks" min={4} max={24} defaultValue={defaults?.weeks ?? 12} /></label>
          <label><span className="label">Days/week</span><input className="input" type="number" name="days_per_week" min={2} max={6} defaultValue={defaults?.days_per_week} placeholder="from intake" /></label>
        </div>
      )}
      {!compact && program && (
        <details className="border-t border-fg/15 pt-3" open={program.split != null || program.skill != null}>
          <summary className="cursor-pointer text-sm font-semibold">Program style and focus</summary>
          <p className="mt-1 text-xs text-muted">Leave on Auto to let the client&apos;s goal, experience, age, days and time decide.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Program style</span>
              <select className="input" name="split" defaultValue={program.split ?? "auto"}>
                <option value="auto">Auto: {PROGRAM_STYLES[program.auto.split].label}</option>
                {SPLITS.map((s) => <option key={s} value={s}>{PROGRAM_STYLES[s].label} ({splitDaysLabel(s)}{PROGRAM_STYLES[s].needsGym ? ", gym" : ""})</option>)}
              </select>
              <span className="mt-1 block text-xs text-muted">Auto picks {PROGRAM_STYLES[program.auto.split].label.toLowerCase()}. {program.auto.reason}</span>
            </label>
            <label className="sm:col-span-2">
              <span className="label">Skill goal</span>
              <select className="input" name="skill" defaultValue={program.skill ?? "auto"}>
                <option value="auto">Auto: {program.autoSkill ? SKILLS[program.autoSkill].label : "none found in their goals"}</option>
                <option value="none">None</option>
                {SKILL_KEYS.map((k) => <option key={k} value={k}>{SKILLS[k].label}</option>)}
              </select>
              <span className="mt-1 block text-xs text-muted">A skill goal opens every session with a step-by-step progression (e.g. support hold → tuck L-sit → one-leg L-sit → L-sit) plus its supporting work.</span>
            </label>
            <label>
              <span className="label">Session length (min)</span>
              <input className="input" type="number" name="session_length_min" min={20} max={120} defaultValue={program.session_length_min} />
            </label>
            <fieldset>
              <legend className="label">Focus areas (extra work)</legend>
              <input type="hidden" name="focus_set" value="1" />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {FOCUS_AREAS.map((f) => (
                  <label key={f} className="flex items-center gap-1.5"><input type="checkbox" name="focus" value={f} defaultChecked={program.focus.includes(f)} />{FOCUS_LABELS[f]}</label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="hidden" name="rotate_set" value="1" />
              <input type="checkbox" name="rotate_accessories" defaultChecked={program.rotate} className="mt-1" />
              <span>Change accessory exercises every 4-week block <span className="block text-xs text-muted">Main lifts stay the same so strength progress stays comparable.</span></span>
            </label>
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted">What each style is</summary>
            <ul className="mt-2 space-y-1.5">{SPLITS.map((s) => <li key={s}><b>{PROGRAM_STYLES[s].label}</b> ({splitDaysLabel(s)}): {PROGRAM_STYLES[s].description}</li>)}</ul>
          </details>
        </details>
      )}
      <p className="text-xs text-muted">Numbers come from the deterministic calculators; Claude only picks exercises from the filtered library and writes short notes. Output is validated before it is saved as a DRAFT.</p>
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
