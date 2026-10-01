"use client";
import { ConfirmableForm } from "./confirmable-form";
import { quickCheckinAction, quickMeasurementsAction, quickWeighInAction, testResultAction } from "@/app/actions/entries";
import { MEASUREMENT_SITES } from "@/config/metrics";

const today = () => new Date().toLocaleDateString("en-CA");

export function WeighInForm({ clientId }: { clientId: string }) {
  return (
    <ConfirmableForm action={quickWeighInAction.bind(null, clientId)} submitLabel="Save weigh-in" className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input className="input" type="date" name="date" defaultValue={today()} />
        <input className="input" type="number" step="0.1" name="weight" placeholder="lb" required />
      </div>
    </ConfirmableForm>
  );
}

export function CheckinForm({ clientId }: { clientId: string }) {
  return (
    <ConfirmableForm action={quickCheckinAction.bind(null, clientId)} submitLabel="Save check-in" className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <input className="input col-span-2" type="date" name="date" defaultValue={today()} />
        <input className="input" type="number" name="energy_1_10" min={1} max={10} placeholder="Energy 1–10" />
        <input className="input" type="number" step="0.1" name="sleep_hrs" placeholder="Sleep hrs (avg)" />
        <input className="input" type="number" name="adherence_pct" min={0} max={100} placeholder="Adherence %" />
        <input className="input" type="number" name="stress_1_10" min={1} max={10} placeholder="Stress 1–10" />
        <input className="input" type="number" name="cardio_min" placeholder="Cardio min (week)" />
        <input className="input" type="number" name="steps" placeholder="Steps/day (avg)" />
        <textarea className="input col-span-2" name="notes" rows={2} placeholder="Notes" />
        <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="followup" /> Flag for follow-up</label>
        <input className="input col-span-2" name="followup_reason" placeholder="Follow-up reason" />
      </div>
    </ConfirmableForm>
  );
}

export function MeasurementsForm({ clientId }: { clientId: string }) {
  return (
    <ConfirmableForm action={quickMeasurementsAction.bind(null, clientId)} submitLabel="Save measurements" className="space-y-2">
      <input className="input" type="date" name="date" defaultValue={today()} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MEASUREMENT_SITES.map((s) => <input key={s} className="input" type="number" step="0.1" name={s} placeholder={`${s} (in)`} />)}
      </div>
    </ConfirmableForm>
  );
}

export function TestResultForm({ clientId, benchmarks }: { clientId: string; benchmarks: { id: string; name: string; unit: string | null }[] }) {
  if (benchmarks.length === 0) return <p className="muted">No benchmarks yet — they are created from the goal presets when a plan is approved, or add one on the progress page.</p>;
  return (
    <ConfirmableForm action={testResultAction.bind(null, clientId)} submitLabel="Save result" className="space-y-2">
      <select className="input" name="benchmark_id" required>
        {benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.unit ? ` (${b.unit})` : ""}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" type="date" name="date" defaultValue={today()} />
        <input className="input" type="number" step="any" name="value" placeholder="Value" required />
      </div>
      <input className="input" name="note" placeholder="Note" />
    </ConfirmableForm>
  );
}
