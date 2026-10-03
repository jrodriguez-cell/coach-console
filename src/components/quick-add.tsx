"use client";
import { ConfirmableForm } from "./confirmable-form";
import { quickCheckinAction, quickMeasurementsAction, quickWeighInAction, testResultAction } from "@/app/actions/entries";
import { MEASUREMENT_SITES } from "@/config/metrics";

const today = () => new Date().toLocaleDateString("en-CA");

/** Visible label above a field (placeholders vanish once you type). */
function L({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function WeighInForm({ clientId }: { clientId: string }) {
  return (
    <ConfirmableForm action={quickWeighInAction.bind(null, clientId)} submitLabel="Save weigh-in" className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <L label="Date"><input className="input" type="date" name="date" defaultValue={today()} /></L>
        <L label="Weight (lb)"><input className="input" type="number" inputMode="decimal" step="0.1" name="weight" required /></L>
      </div>
    </ConfirmableForm>
  );
}

export function CheckinForm({ clientId }: { clientId: string }) {
  return (
    <ConfirmableForm action={quickCheckinAction.bind(null, clientId)} submitLabel="Save check-in" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <L label="Date" className="col-span-2"><input className="input" type="date" name="date" defaultValue={today()} /></L>
        <L label="Energy (1–10)"><input className="input" type="number" inputMode="numeric" name="energy_1_10" min={1} max={10} /></L>
        <L label="Sleep (avg hrs)"><input className="input" type="number" inputMode="decimal" step="0.1" name="sleep_hrs" /></L>
        <L label="Adherence %"><input className="input" type="number" inputMode="numeric" name="adherence_pct" min={0} max={100} /></L>
        <L label="Stress (1–10)"><input className="input" type="number" inputMode="numeric" name="stress_1_10" min={1} max={10} /></L>
        <L label="Cardio (min/week)"><input className="input" type="number" inputMode="numeric" name="cardio_min" /></L>
        <L label="Steps (avg/day)"><input className="input" type="number" inputMode="numeric" name="steps" /></L>
        <L label="Notes" className="col-span-2"><textarea className="input" name="notes" rows={2} /></L>
        <label className="col-span-2 flex min-h-[36px] items-center gap-2"><input type="checkbox" name="followup" /> Flag for follow-up</label>
        <L label="Follow-up reason" className="col-span-2"><input className="input" name="followup_reason" /></L>
      </div>
    </ConfirmableForm>
  );
}

export function MeasurementsForm({ clientId }: { clientId: string }) {
  return (
    <ConfirmableForm action={quickMeasurementsAction.bind(null, clientId)} submitLabel="Save measurements" className="space-y-2">
      <L label="Date"><input className="input" type="date" name="date" defaultValue={today()} /></L>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MEASUREMENT_SITES.map((s) => <L key={s} label={`${s} (in)`}><input className="input" type="number" inputMode="decimal" step="0.1" name={s} /></L>)}
      </div>
    </ConfirmableForm>
  );
}

export function TestResultForm({ clientId, benchmarks }: { clientId: string; benchmarks: { id: string; name: string; unit: string | null }[] }) {
  if (benchmarks.length === 0) return <p className="muted">No benchmarks yet — they are created from the goal presets when a plan is approved, or add one on the progress page.</p>;
  return (
    <ConfirmableForm action={testResultAction.bind(null, clientId)} submitLabel="Save result" className="space-y-2">
      <select className="input" name="benchmark_id" required aria-label="Benchmark">
        {benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.unit ? ` (${b.unit})` : ""}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <L label="Date"><input className="input" type="date" name="date" defaultValue={today()} /></L>
        <L label="Value"><input className="input" type="number" inputMode="decimal" step="any" name="value" required /></L>
      </div>
      <L label="Note"><input className="input" name="note" /></L>
    </ConfirmableForm>
  );
}
