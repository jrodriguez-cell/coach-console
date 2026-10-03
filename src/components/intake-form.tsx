"use client";
import { createContext, useContext, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { saveIntakeAction } from "@/app/actions/clients";
import { SubmitButton } from "./submit-button";
import { PARQ_QUESTIONS, REFER_OUT_FLAGS, REFER_OUT_KEYS, type IntakeAnswers, type ReferOutFlags } from "@/lib/intake";
import { CONTRAINDICATION_TAGS } from "@/data/exercises";
import { ALLERGENS, DIETARY_PATTERNS } from "@/data/foods";
import { NEAT_FACTORS } from "@/config/energy";
import { COOKING_LABEL, EQUIPMENT_LABEL, HISTORY_LABEL } from "@/lib/labels";
import { DAY_NAMES } from "@/lib/dates";

const STEPS = ["Goals", "Body & history", "Health screening", "Nutrition", "Schedule"] as const;
const StepContext = createContext(1);

function Section({ title, children, hint, step }: { title: string; children: React.ReactNode; hint?: string; step: number }) {
  const current = useContext(StepContext);
  return (
    <fieldset data-step={step} hidden={step !== current} className="card space-y-3">
      <legend className="px-1 text-base font-semibold">{title}</legend>
      {hint && <p className="muted -mt-2">{hint}</p>}
      {children}
    </fieldset>
  );
}

function F({ label, children, hint, wide }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={wide ? "col-span-full block" : "block"}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function IntakeForm({ clientId, prev, parq, refer }: { clientId: string; prev: Partial<IntakeAnswers> | null; parq: boolean[] | null; refer: Partial<ReferOutFlags> | null }) {
  const [state, action] = useFormState(saveIntakeAction.bind(null, clientId), { error: null });
  const a = prev ?? {};
  const ft = a.height_in ? Math.floor(a.height_in / 12) : "";
  const inch = a.height_in ? Math.round((a.height_in % 12) * 10) / 10 : "";
  const cx = a.current_exercise ?? [];
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const last = STEPS.length;
  const editing = prev != null;
  // Check only the visible step's fields before moving on.
  const stepValid = () => {
    const fields = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`fieldset[data-step="${step}"] :is(input, select, textarea)`) ?? [];
    for (const f of Array.from(fields)) if (!f.checkValidity()) return f.reportValidity();
    return true;
  };
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <StepContext.Provider value={step}>
    <form
      ref={formRef}
      action={action}
      className="space-y-6"
      // A required answer on another step: jump there so the browser can show it.
      onInvalidCapture={(e) => {
        const fs = (e.target as HTMLElement).closest<HTMLElement>("fieldset[data-step]");
        if (fs && Number(fs.dataset.step) !== step) setStep(Number(fs.dataset.step));
      }}
    >
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">{STEPS[step - 1]}</span>
          <span className="text-muted">Step {step} of {last}</span>
        </div>
        <div className="grid grid-cols-5 gap-1" aria-hidden>
          {STEPS.map((label, i) => (
            <button key={label} type="button" title={label} onClick={() => (i + 1 < step || editing ? go(i + 1) : stepValid() && go(i + 1))} className={`h-1.5 ${i + 1 <= step ? "bg-fg" : "bg-fg/20"}`} />
          ))}
        </div>
      </div>
      <Section step={1} title="Purpose and goals">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <F label="Primary goal" wide><input className="input" name="primary_goal" defaultValue={a.primary_goal} /></F>
          <F label="What does success look like in 90 days?" wide><textarea className="input" name="success_90_days" rows={2} defaultValue={a.success_90_days} /></F>
          <F label="Timeline or event"><input className="input" name="timeline_event" defaultValue={a.timeline_event} /></F>
          <F label="Event date"><input className="input" type="date" name="event_date" defaultValue={a.event_date ?? ""} /></F>
          <F label="Sport / activity (performance goals)" wide><input className="input" name="sport_activity" defaultValue={a.sport_activity} /></F>
        </div>
      </Section>

      <Section step={1} title="Preferences">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <F label="Exercises they enjoy"><textarea className="input" name="exercise_likes" rows={2} defaultValue={a.exercise_likes} /></F>
          <F label="Exercises they dislike" hint="Comma-separated; matching library exercises are excluded."><textarea className="input" name="exercise_dislikes" rows={2} defaultValue={(a.exercise_dislikes ?? []).join(", ")} /></F>
          <F label="Cardio preferences" wide><input className="input" name="cardio_preferences" defaultValue={a.cardio_preferences} /></F>
        </div>
      </Section>

      <Section step={2} title="Status and history">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <F label="Age"><input className="input" type="number" name="age" required min={14} max={100} defaultValue={a.age} /></F>
          <F label="Sex (for energy equations)">
            <select className="input" name="sex" required defaultValue={a.sex ?? ""}>
              <option value="" disabled>Choose</option><option value="female">Female</option><option value="male">Male</option>
            </select>
          </F>
          <F label="Height (ft)"><input className="input" type="number" name="height_ft" required min={4} max={7} defaultValue={ft} /></F>
          <F label="Height (in)"><input className="input" type="number" step="0.5" name="height_in_rem" required min={0} max={11.5} defaultValue={inch} /></F>
          <F label="Weight (lb)"><input className="input" type="number" step="0.1" name="weight_lb" required defaultValue={a.weight_lb} /></F>
          <F label="Body fat % (optional)"><input className="input" type="number" step="0.1" name="body_fat_pct" defaultValue={a.body_fat_pct ?? ""} /></F>
          <F label="Goal weight (lb, optional)"><input className="input" type="number" step="0.1" name="goal_weight_lb" defaultValue={a.goal_weight_lb ?? ""} /></F>
          <F label="Training history">
            <select className="input" name="training_history" defaultValue={a.training_history ?? "beginner"}>
              {Object.entries(HISTORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          <F label="Daily activity outside exercise" wide>
            <select className="input" name="activity_level" defaultValue={a.activity_level ?? "sedentary"}>
              {Object.entries(NEAT_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label} (×{v.factor})</option>)}
            </select>
          </F>
          <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" name="deconditioned" defaultChecked={a.deconditioned} /> Deconditioned (start cardio and training at the low end)</label>
        </div>
        <div>
          <span className="label">Current exercise (baseline, per week)</span>
          <p className="mb-2 text-xs text-muted">Needed for measured-mode TDEE so the program isn&apos;t double-counted.</p>
          <div className="mb-1 grid grid-cols-3 gap-2 text-xs text-muted" aria-hidden><span>Activity</span><span>Sessions / week</span><span>Minutes each</span></div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mb-2 grid grid-cols-3 gap-2">
              <select className="input" name={`cx_type_${i}`} aria-label={`Activity ${i + 1}`} defaultValue={cx[i]?.type ?? ""}>
                <option value="">—</option>
                {["strength", "walking", "jogging", "running", "cycling", "mobility", "yoga", "sport"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="input" type="number" inputMode="numeric" name={`cx_sessions_${i}`} aria-label={`Activity ${i + 1} sessions per week`} defaultValue={cx[i]?.sessions_per_week} />
              <input className="input" type="number" inputMode="numeric" name={`cx_minutes_${i}`} aria-label={`Activity ${i + 1} minutes each`} defaultValue={cx[i]?.minutes} />
            </div>
          ))}
          <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" name="current_exercise_confirmed" defaultChecked={a.current_exercise_confirmed && cx.length === 0} /> Client currently does no structured exercise</label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <F label="Measured TDEE (wearable, kcal/day)" hint="Optional. Average over at least 14 days."><input className="input" type="number" name="measured_tdee" defaultValue={a.measured_tdee ?? ""} /></F>
          <F label="Days averaged"><input className="input" type="number" name="measured_tdee_days" defaultValue={a.measured_tdee_days ?? ""} /></F>
          <F label="Wearable active kcal/day from current exercise" hint="Alternative baseline for measured mode."><input className="input" type="number" name="wearable_active_kcal_per_day" defaultValue={a.wearable_active_kcal_per_day ?? ""} /></F>
        </div>
      </Section>

      <Section step={3} title="PAR-Q" hint="Any “yes” flags the client NEEDS PHYSICIAN CLEARANCE; the plan cannot be approved until clearance status is recorded.">
        {PARQ_QUESTIONS.map((q, i) => (
          <div key={i} className="flex flex-col gap-2 border-b sm:flex-row sm:items-start sm:justify-between sm:gap-4 border-fg/15 pb-2 text-sm">
            <span>{i + 1}. {q}</span>
            <span className="flex shrink-0 gap-3">
              <label className="flex items-center gap-1"><input type="radio" name={`parq_${i}`} value="no" required defaultChecked={parq ? !parq[i] : false} /> No</label>
              <label className="flex items-center gap-1"><input type="radio" name={`parq_${i}`} value="yes" defaultChecked={parq ? parq[i] : false} /> Yes</label>
            </span>
          </div>
        ))}
      </Section>

      <Section step={3} title="Health and refer-out screening" hint="Flags show a Refer-out banner and block generation of the affected section until you record how it was handled. Advice about these is never auto-generated.">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {REFER_OUT_KEYS.map((k) => (
            <label key={k} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={`refer_${k}`} defaultChecked={Boolean(refer?.[k])} className="mt-1" />
              <span><b>{REFER_OUT_FLAGS[k].label}</b><br /><span className="text-xs text-muted">{REFER_OUT_FLAGS[k].hint}</span></span>
            </label>
          ))}
        </div>
        <F label="Screening notes" wide><textarea className="input" name="refer_notes" rows={2} defaultValue={refer?.notes ?? ""} /></F>
        <F label="Injuries / limitations (free text)" wide><textarea className="input" name="injuries_text" rows={2} defaultValue={a.injuries_text} /></F>
        <div>
          <span className="label">Areas to protect (exercises contraindicated for these are excluded)</span>
          <div className="flex flex-wrap gap-3 text-sm">
            {CONTRAINDICATION_TAGS.map((t) => (
              <label key={t} className="flex items-center gap-1"><input type="checkbox" name="injury_areas" value={t} defaultChecked={a.injury_areas?.includes(t)} /> {t.replace("_", " ")}</label>
            ))}
          </div>
        </div>
      </Section>

      <Section step={4} title="Nutrition preferences">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <F label="Dietary pattern">
            <select className="input" name="dietary_pattern" defaultValue={a.dietary_pattern ?? "omnivore"}>
              {DIETARY_PATTERNS.map((d) => <option key={d} value={d}>{d.replace("_", " ")}</option>)}
            </select>
          </F>
          <F label="Meals per day"><input className="input" type="number" name="meals_per_day" min={2} max={6} defaultValue={a.meals_per_day ?? 3} /></F>
          <F label="Cooking time">
            <select className="input" name="cooking_time" defaultValue={a.cooking_time ?? "moderate"}>
              {Object.entries(COOKING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
        </div>
        <div>
          <span className="label">Allergies</span>
          <div className="flex flex-wrap gap-3 text-sm">
            {ALLERGENS.map((al) => (
              <label key={al} className="flex items-center gap-1"><input type="checkbox" name="allergies" value={al} defaultChecked={a.allergies?.includes(al)} /> {al.replace("_", " ")}</label>
            ))}
          </div>
        </div>
        <F label="Foods disliked / excluded" hint="Comma-separated (e.g. tuna, mushrooms)." wide><input className="input" name="foods_excluded" defaultValue={(a.foods_excluded ?? []).join(", ")} /></F>
        <F label="Supplements" wide><input className="input" name="supplements" defaultValue={a.supplements} /></F>
      </Section>

      <Section step={5} title="Equipment and schedule">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <F label="Training days per week"><input className="input" type="number" name="training_days_per_week" min={2} max={6} required defaultValue={a.training_days_per_week ?? 3} /></F>
          <F label="Session length (min)"><input className="input" type="number" name="session_length_min" min={20} max={120} required defaultValue={a.session_length_min ?? 60} /></F>
          <F label="Equipment access">
            <select className="input" name="equipment" defaultValue={a.equipment ?? "commercial_gym"}>
              {Object.entries(EQUIPMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
        </div>
        <div>
          <span className="label">Preferred lifting days</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {DAY_NAMES.map((d, i) => (
              <label key={d} className="flex items-center gap-1"><input type="checkbox" name="preferred_days" value={i} defaultChecked={a.preferred_days?.includes(i)} /> {d}</label>
            ))}
          </div>
        </div>
      </Section>

      {state.error && <p className="note-alert p-2 text-sm">{state.error}</p>}
      <div className="sticky bottom-20 z-20 -mx-4 flex gap-2 border-t border-fg/15 bg-canvas px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:px-0 lg:bottom-0">
        {step > 1 && <button type="button" className="btn" onClick={() => go(step - 1)}>Back</button>}
        {step < last && <button type="button" className={`btn ${editing ? "" : "btn-primary"} flex-1 sm:flex-none`} onClick={() => stepValid() && go(step + 1)}>Next: {STEPS[step]}</button>}
        {(step === last || editing) && <SubmitButton className={`${step === last ? "btn-primary" : ""} flex-1 sm:flex-none`} pendingText="Saving…">Save intake</SubmitButton>}
      </div>
    </form>
    </StepContext.Provider>
  );
}
