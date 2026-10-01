import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { Banner, Card, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deleteClientAction, saveSettingsAction } from "@/app/actions/settings";
import { GOAL_CATEGORIES } from "@/config/goal-templates";
import { goalLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  outreachDays: "Reach out after N days without contact",
  weighInMissingDays: "Weigh-in missing after N days",
  adherenceWindowDays: "Adherence window (days)",
  adherenceLowPct: "Adherence check-in below %",
  energyLow: "Energy follow-up below (1–10), twice in a row",
  strengthRetentionPct: "Strength flag below % of baseline (weight loss)",
  trainingGapDays: "Training check-in after N days without sessions",
  clearanceFollowUpDays: "Clearance follow-up after N days",
  prospectFollowUpDays: "Prospect follow-up after N days",
  recheckWeeksAfterEnd: "Post-program recheck (weeks after end)",
  weighInOverdueHour: "Weigh-in overdue after this hour on Monday",
  dailyDigest: "Send a daily digest email (weekly digest always on)",
};

export default async function SettingsPage({ searchParams }: { searchParams: { deleted?: string } }) {
  const db = createClient();
  const s = await getSettings(db);
  const { data: clients } = await db.from("clients").select("id, name").order("name");
  return (
    <div className="space-y-4">
      <h1>Settings</h1>
      {searchParams.deleted && <Banner tone="green" title="Client data deleted." />}
      <div className="flex gap-2">
        <Link className="btn" href="/settings/metrics">Tracked metrics</Link>
        <Link className="btn" href="/settings/exercises">Exercise library</Link>
        <Link className="btn" href="/settings/foods">Food library</Link>
      </div>
      <form action={saveSettingsAction} className="space-y-4">
        <Card title="Nutrition disclaimer (printed on every nutrition page and export)">
          <textarea className="input" name="disclaimer" rows={4} defaultValue={s.disclaimer} />
        </Card>
        <Card title="Outreach and task thresholds">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(s.task_thresholds).map(([k, v]) =>
              typeof v === "boolean" ? (
                <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`t_${k}`} defaultChecked={v} /> {LABELS[k] ?? k}</label>
              ) : (
                <Field key={k} label={LABELS[k] ?? k}><input className="input" type="number" step="any" name={`t_${k}`} defaultValue={v} /></Field>
              ),
            )}
          </div>
        </Card>
        <Card title="Guardrail defaults (ISSA CPT textbook)">
          <p className="mb-2 text-xs text-slate-500">Hard floors cannot be lowered below 1,200 kcal/day or 15% fat.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(s.guardrail_limits).map(([k, v]) => <Field key={k} label={k}><input className="input" type="number" step="any" name={`g_${k}`} defaultValue={v} /></Field>)}
          </div>
        </Card>
        <Card title="Default calorie balance by goal (kcal/day; positive = deficit, negative = surplus)">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {GOAL_CATEGORIES.map((g) => <Field key={g} label={goalLabel(g)}><input className="input" type="number" name={`d_${g}`} defaultValue={s.default_deficits[g]} /></Field>)}
          </div>
        </Card>
        <Card title="Energy-model uncertainty (fraction of TDEE)">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(s.uncertainty).map(([k, v]) => <Field key={k} label={k}><input className="input" type="number" step="0.01" name={`u_${k}`} defaultValue={v} /></Field>)}
          </div>
        </Card>
        <SubmitButton className="btn-primary">Save settings</SubmitButton>
      </form>

      <Card title="Client data: export or delete">
        <p className="mb-2 text-sm">Export downloads everything stored for one client as JSON. Deleting removes the client and all linked records permanently.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            {(clients ?? []).map((c) => <div key={c.id}><a href={`/api/clients/${c.id}/export`}>Export {c.name}</a></div>)}
          </div>
          <form action={deleteClientAction} className="space-y-2">
            <select className="input" name="client_id" required>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input className="input" name="confirm_name" placeholder="Type the client's full name to confirm" required />
            <SubmitButton className="btn-danger" confirm="Permanently delete this client's data?">Delete client data</SubmitButton>
          </form>
        </div>
      </Card>
    </div>
  );
}
