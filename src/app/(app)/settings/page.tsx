import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { Banner, Card, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deleteClientAction, saveAiGuidanceAction, saveSettingsAction } from "@/app/actions/settings";
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

/** "carbPctMinWeightLoss" → "Carb % min weight loss" */
const humanize = (k: string) => {
  const w = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\bPct\b/gi, "%").toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
};

export default async function SettingsPage({ searchParams }: { searchParams: { deleted?: string } }) {
  const db = createClient();
  const s = await getSettings(db);
  const { data: clients } = await db.from("clients").select("id, name").order("name");
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" display />
      {searchParams.deleted && <Banner tone="green" title="Client data deleted." />}
      <div className="actions">
        <Link className="btn" href="/settings/metrics">Metrics</Link>
        <Link className="btn" href="/settings/exercises">Exercises</Link>
        <Link className="btn" href="/settings/foods">Foods</Link>
      </div>
      <Card title="Program engine">
        <p className="muted mb-3">What the plan generator knows, and where to change it.</p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form action={saveAiGuidanceAction} className="space-y-2">
            <label className="block">
              <span className="label">Your coaching rules for the AI</span>
              <textarea className="input" name="ai_guidance" rows={7} defaultValue={s.ai_guidance} placeholder={"e.g.\n- Beginners: prefer machines and dumbbells over barbells.\n- Always include a rear-delt or face-pull movement.\n- For calisthenics goals, favour bodyweight options.\n- Avoid jumping for clients over 60."} />
            </label>
            <p className="text-xs text-muted">Claude reads these on every new plan when choosing among the allowed exercises and writing coaching notes. It still can&apos;t change sets, reps, calories or the safety screens.</p>
            <SubmitButton className="btn-primary">Save coaching rules</SubmitButton>
          </form>
          <div className="space-y-3 text-sm">
            <div><b>Exercise library</b> · <Link href="/settings/exercises">edit</Link><p className="text-muted">Every exercise Claude can pick and every swap suggestion comes from here. Swaps list exercises with the same movement pattern that fit the client&apos;s equipment, injuries and dislikes. Add exercises, fix equipment and injury tags, set easier/harder links and add a demo video URL (used by &ldquo;How to&rdquo;).</p></div>
            <div><b>Client details</b><p className="text-muted">Goals, equipment, injuries, likes and dislikes on each plan&apos;s Overview steer which exercises are allowed and what the program focuses on.</p></div>
            <div><b>Program rules</b> (in code)<p className="text-muted">Program styles and session templates, skill progressions (L-sit and others), sets/reps by phase and goal guidelines live in <code>src/config/</code>. Ask for changes there.</p></div>
          </div>
        </div>
      </Card>
      <form action={saveSettingsAction} className="space-y-4">
        <Card title="Nutrition disclaimer">
          <p className="muted mb-2">Printed on every nutrition page and export.</p>
          <textarea className="input" name="disclaimer" rows={4} defaultValue={s.disclaimer} />
        </Card>
        <Card title="Task thresholds">
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
        <Card title="Guardrails">
          <p className="muted mb-3">ISSA CPT textbook defaults. Hard floors cannot be lowered below 1,200 kcal/day or 15% fat.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(s.guardrail_limits).map(([k, v]) => <Field key={k} label={humanize(k)}><input className="input" type="number" step="any" name={`g_${k}`} defaultValue={v} /></Field>)}
          </div>
        </Card>
        <Card title="Calorie balance by goal">
          <p className="muted mb-3">kcal/day. Positive is a deficit, negative a surplus.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {GOAL_CATEGORIES.map((g) => <Field key={g} label={goalLabel(g)}><input className="input" type="number" name={`d_${g}`} defaultValue={s.default_deficits[g]} /></Field>)}
          </div>
        </Card>
        <Card title="Energy-model uncertainty">
          <p className="muted mb-3">Fraction of TDEE.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(s.uncertainty).map(([k, v]) => <Field key={k} label={humanize(k)}><input className="input" type="number" step="0.01" name={`u_${k}`} defaultValue={v} /></Field>)}
          </div>
        </Card>
        <SubmitButton className="btn-primary w-full sm:w-auto">Save settings</SubmitButton>
      </form>

      <Card title="Client data">
        <p className="mb-2 text-sm">Export downloads everything stored for one client as JSON. Deleting removes the client and all linked records permanently.</p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            {(clients ?? []).map((c) => <div key={c.id}><a href={`/api/clients/${c.id}/export`}>Export {c.name}</a></div>)}
          </div>
          <form action={deleteClientAction} className="space-y-2">
            <select className="input" name="client_id" required>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input className="input" name="confirm_name" placeholder="Type the client's full name to confirm" required />
            <SubmitButton className="btn-danger w-full sm:w-auto" confirm="Permanently delete this client's data?">Delete client data</SubmitButton>
          </form>
        </div>
      </Card>
    </div>
  );
}
