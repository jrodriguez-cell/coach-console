import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/server";
import { getClient, getPlan, latestIntake, planOverrides } from "@/lib/data/clients";
import { approvalIssues } from "@/lib/data/approval";
import { loadExercises } from "@/lib/data/libraries";
import { getSettings } from "@/lib/data/settings";
import { Badge, Banner, Card, Empty, fmt, statusTone } from "@/components/ui";
import { ApproveForm, OverrideForm, PlanEditForm } from "@/components/plan-forms";
import { GenerateForm } from "@/components/generate-form";
import { SubmitButton } from "@/components/submit-button";
import { revisePlanAction } from "@/app/actions/plans";
import { GOAL_TEMPLATES } from "@/config/goal-templates";
import { PHASES } from "@/config/training-variables";
import { METS, NEAT_FACTORS } from "@/config/energy";
import { goalLabel, PATTERN_LABEL } from "@/lib/labels";
import { DAY_NAMES, formatDate } from "@/lib/dates";
import { describePrediction } from "@/lib/energy";
import { holdSeconds, isUsable } from "@/lib/training";
import { candidateFilter } from "@/lib/generator";
import { IntakeAnswersSchema } from "@/lib/intake";
import { planCalendar } from "@/lib/calendar";
import type { PlanRow } from "@/lib/data/types";

export const dynamic = "force-dynamic";

const TABS = ["overview", "training", "nutrition", "calendar", "checkpoints"] as const;
type Tab = (typeof TABS)[number];

export default async function PlanPage({ params, searchParams }: { params: { id: string; planId: string }; searchParams: { tab?: string; week?: string } }) {
  const db = createClient();
  const [client, plan] = await Promise.all([getClient(db, params.id), getPlan(db, params.planId)]);
  if (!client || !plan || plan.client_id !== client.id) notFound();
  const [overrides, issues, settings, intake] = await Promise.all([planOverrides(db, plan.id), plan.status === "draft" ? approvalIssues(db, plan) : Promise.resolve([]), getSettings(db), latestIntake(db, client.id)]);
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "overview";
  const editable = plan.status === "draft";
  const base = `/clients/${client.id}/plan/${plan.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/clients/${client.id}`} className="text-sm">← {client.name}</Link>
          <h1 className="flex items-center gap-2">
            Plan v{plan.version} <Badge tone={plan.status === "approved" ? "green" : plan.status === "draft" ? "yellow" : "gray"}>{plan.status === "draft" ? "DRAFT" : plan.status}</Badge>
          </h1>
          <p className="muted">{goalLabel(plan.goal_category)} · generated {formatDate(plan.generated_at.slice(0, 10))}{plan.approved_at ? ` · approved ${formatDate(plan.approved_at.slice(0, 10))}` : ""} · {plan.training?.selection_source === "llm" ? "exercise picks drafted by Claude from the library" : "library-default exercise picks"}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <a className="btn" href={`/api/plans/${plan.id}/export/xlsx`}>Export Excel</a>
          <a className="btn" href={`/api/plans/${plan.id}/export/pdf`}>Export PDF</a>
          {plan.status !== "draft" && (
            <form action={revisePlanAction.bind(null, plan.id)}><SubmitButton>Create revision</SubmitButton></form>
          )}
          {editable && <ApproveForm planId={plan.id} />}
        </div>
      </div>

      {plan.status === "draft" && (
        <Banner tone={issues.length ? "yellow" : "green"} title={issues.length ? "DRAFT — not approved. Before you can approve:" : "DRAFT — ready to approve."}>
          {issues.length > 0 && <ul className="list-disc pl-5">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>}
          <p className="mt-1 text-xs">There is no sending to clients in v1. Exports are labeled DRAFT until approval.</p>
        </Banner>
      )}

      {plan.training?.clearance_notes && (
        <Banner tone="red" title="Physician clearance notes">
          <pre className="whitespace-pre-wrap font-sans">{plan.training.clearance_notes}</pre>
        </Banner>
      )}

      <GuardrailPanel plan={plan} overrides={overrides} editable={editable} />

      <div className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b border-slate-800 px-3 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link key={t} href={`${base}?tab=${t}`} className={clsx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm capitalize no-underline hover:no-underline", t === tab ? "border-sky-500 font-semibold text-slate-50" : "border-transparent text-slate-400 hover:text-slate-200")}>
            {t === "nutrition" ? "Nutrition guidance" : t}
          </Link>
        ))}
      </div>

      {tab === "overview" && <Overview plan={plan} editable={editable} clientId={client.id} purpose={client.purpose_text} intakeGoal={intake?.answers.primary_goal} />}
      {tab === "training" && <Training plan={plan} editable={editable} week={Number(searchParams.week ?? 1)} base={base} candidates={await swapCandidates(db, plan, intake?.answers)} />}
      {tab === "nutrition" && <Nutrition plan={plan} editable={editable} disclaimer={settings.disclaimer} hasGoalWeight={Boolean(intake?.answers.goal_weight_lb)} />}
      {tab === "calendar" && <Calendar plan={plan} />}
      {tab === "checkpoints" && <Checkpoints plan={plan} clientId={client.id} />}
    </div>
  );
}

async function swapCandidates(db: ReturnType<typeof createClient>, plan: PlanRow, answers: unknown) {
  if (!plan.training || !answers) return {};
  const intake = IntakeAnswersSchema.parse(answers);
  const lib = await loadExercises(db);
  const f = candidateFilter(intake);
  const out: Record<string, { id: string; name: string }[]> = {};
  for (const s of plan.training.sessions) for (const sl of s.slots) out[sl.id] = lib.filter((e) => e.pattern === sl.pattern && isUsable(e, f)).map((e) => ({ id: e.id, name: e.name }));
  return out;
}

function GuardrailPanel({ plan, overrides, editable }: { plan: PlanRow; overrides: { rule_key: string; reason: string }[]; editable: boolean }) {
  const flags = plan.guardrail_flags ?? [];
  if (!flags.length) return null;
  const notOk = flags.filter((f) => f.status !== "ok");
  return (
    <Card title="Guardrails" actions={<span className="text-xs text-slate-400">{flags.length - notOk.length} ok · {notOk.filter((f) => f.status === "warn").length} warn · {notOk.filter((f) => f.status === "blocked").length} blocked</span>}>
      <ul className="space-y-2 text-sm">
        {notOk.map((f) => {
          const ov = overrides.filter((o) => o.rule_key === f.rule_key);
          return (
            <li key={f.rule_key}>
              <Badge tone={statusTone(f.status)}>{f.status.toUpperCase()}</Badge> <b>{f.label}</b>{f.value ? ` (${f.value})` : ""} — {f.message}
              {f.status === "warn" && (ov.length ? <div className="text-xs text-green-300">Override: {ov.map((o) => o.reason).join("; ")}</div> : editable && <OverrideForm planId={plan.id} ruleKey={f.rule_key} />)}
              {f.status === "blocked" && <div className="text-xs text-red-300">Cannot be overridden. Change the plan inputs.</div>}
            </li>
          );
        })}
      </ul>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-slate-400">Show passing checks</summary>
        <ul className="mt-1 space-y-1">
          {flags.filter((f) => f.status === "ok").map((f) => <li key={f.rule_key}><Badge tone="green">OK</Badge> {f.label}{f.value ? ` (${f.value})` : ""} — {f.message}</li>)}
        </ul>
      </details>
    </Card>
  );
}

function Overview({ plan, editable, clientId, purpose, intakeGoal }: { plan: PlanRow; editable: boolean; clientId: string; purpose: string | null; intakeGoal?: string }) {
  const p = plan.parameters;
  const tpl = GOAL_TEMPLATES[plan.goal_category];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title={`${tpl.label}: programming guidelines`}>
        {(purpose || intakeGoal) && <p className="mb-2 text-sm">Purpose: {purpose || intakeGoal}</p>}
        <ol className="list-decimal space-y-1 pl-5 text-sm">{tpl.guidelines.map((g) => <li key={g}>{g}</li>)}</ol>
        <p className="mt-2 text-sm">Cardio: {tpl.cardio.intensity}; {tpl.cardio.freqMin}–{tpl.cardio.freqMax} sessions/week, {tpl.cardio.minMin}–{tpl.cardio.minMax} min{tpl.cardio.weeklyTargetMin ? `, building to ${tpl.cardio.weeklyTargetMin}+ min/week` : ""}.</p>
        {plan.training?.program_summary && <p className="mt-3 text-sm"><b>Summary:</b> {plan.training.program_summary}</p>}
        {plan.training?.coaching_notes?.length ? <ul className="mt-2 list-disc pl-5 text-sm">{plan.training.coaching_notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
      </Card>
      <Card title="Parameters">
        <div className="table-wrap"><table className="table text-sm">
          <tbody>
            <tr><td>Start date</td><td>{formatDate(p.start_date)}</td></tr>
            <tr><td>Length</td><td>{p.weeks} weeks · {p.days_per_week} lifting days/week · {p.session_length_min} min sessions</td></tr>
            <tr><td>Phases (4-week blocks)</td><td>{p.phase_sequence.map((ph) => PHASES[ph].label).join(" → ")}</td></tr>
            <tr><td>Calorie target mode</td><td>{p.calorie_mode === "fixed" ? `fixed at ${p.target_override} kcal` : `${p.deficit >= 0 ? "deficit" : "surplus"} of ${Math.abs(p.deficit)} kcal/day`}</td></tr>
            <tr><td>Energy model</td><td>{p.energy_mode} mode · {p.bmr_method === "katch" ? "Katch-McArdle" : "Mifflin-St Jeor"} · {NEAT_FACTORS[p.neat_level].label}</td></tr>
            <tr><td>Checkpoints</td><td>weeks {p.checkpoint_weeks.join(", ") || "—"}</td></tr>
          </tbody>
        </table></div>
        {editable && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Change structure (regenerates a new draft)</summary>
            <div className="mt-2"><GenerateForm clientId={clientId} fromPlanId={plan.id} defaults={{ start_date: p.start_date, weeks: p.weeks, days_per_week: p.days_per_week }} label="Regenerate draft" /></div>
            <p className="mt-1 text-xs text-slate-400">The current draft is archived and kept as a version.</p>
          </details>
        )}
      </Card>
    </div>
  );
}

function Training({ plan, editable, week, base, candidates }: { plan: PlanRow; editable: boolean; week: number; base: string; candidates: Record<string, { id: string; name: string }[]> }) {
  const t = plan.training;
  if (!t) return <Banner tone="red" title="Training not generated">{plan.nutrition?.training_blocked_reason ?? "Refer out before generating training."}</Banner>;
  const wk = t.weeks[Math.min(Math.max(week, 1), t.weeks.length) - 1];
  const cw = t.cardio.weeks[wk.week - 1];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {t.weeks.map((w) => (
          <Link key={w.week} href={`${base}?tab=training&week=${w.week}`} className={clsx("btn btn-sm", w.week === wk.week && "btn-primary")}>
            W{w.week}{w.deload ? " ·D" : ""}
          </Link>
        ))}
      </div>
      <p className="text-sm">
        <b>Week {wk.week}</b> · {PHASES[wk.phase].label}{wk.deload ? " · DELOAD (≈40% fewer sets, stop at RPE 5–6)" : ""}{wk.retest ? " · retest at the last session" : ""} · {t.split_label}, lifting on {t.lifting_days.map((d) => DAY_NAMES[d]).join(", ")}
      </p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {t.sessions.map((s) => (
          <Card key={s.key} title={`${s.name}`} actions={<span className="text-xs text-slate-400">≈{wk.session_minutes[s.key]} min of work + warm-up</span>}>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>RPE</th></tr></thead>
              <tbody>
                {s.slots.map((sl) => {
                  const rx = wk.prescriptions[sl.id];
                  const reps = rx ? (sl.unit === "seconds" ? `${holdSeconds(rx)[0]}–${holdSeconds(rx)[1]} s` : `${rx.reps_min}–${rx.reps_max}`) : "";
                  return (
                    <tr key={sl.id} className={clsx(!rx && "opacity-50")}>
                      <td>
                        <div className="font-medium">{sl.exercise.name} <span className="text-xs font-normal text-slate-400">{PATTERN_LABEL[sl.pattern]} · {sl.role}</span></div>
                        {sl.regression && <div className="text-xs text-slate-400">↓ Regression: {sl.regression.name}</div>}
                        {sl.progression && <div className="text-xs text-slate-400">↑ Progression: {sl.progression.name}</div>}
                        {sl.note && <div className="text-xs italic text-slate-400">{sl.note}</div>}
                        {!rx && <div className="text-xs text-slate-400">Not in this block (session-length limit)</div>}
                        {editable && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-blue-400">Edit</summary>
                            <PlanEditForm planId={plan.id} op="swap" className="mt-1 flex gap-1">
                              <input type="hidden" name="slot_id" value={sl.id} />
                              <select className="input text-xs" name="exercise_id" defaultValue={sl.exercise.id}>
                                {(candidates[sl.id] ?? [sl.exercise]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </PlanEditForm>
                            <PlanEditForm planId={plan.id} op="rx" className="mt-1 grid grid-cols-3 items-end gap-1 text-xs sm:grid-cols-6">
                              <input type="hidden" name="slot_id" value={sl.id} />
                              <input type="hidden" name="week" value={wk.week} />
                              <input type="hidden" name="include" value="on" />
                              <label>Sets<input className="input" name="sets" type="number" defaultValue={rx?.sets ?? 2} /></label>
                              <label>Reps min<input className="input" name="reps_min" type="number" defaultValue={rx?.reps_min ?? 8} /></label>
                              <label>Reps max<input className="input" name="reps_max" type="number" defaultValue={rx?.reps_max ?? 12} /></label>
                              <label>Rest s<input className="input" name="rest_sec" type="number" defaultValue={rx?.rest_sec ?? 60} /></label>
                              <label>RPE min<input className="input" name="rpe_min" type="number" step="0.5" defaultValue={rx?.rpe_min ?? 6} /></label>
                              <label>RPE max<input className="input" name="rpe_max" type="number" step="0.5" defaultValue={rx?.rpe_max ?? 8} /></label>
                              <select className="input col-span-3 sm:col-span-4" name="scope" defaultValue="phase">
                                <option value="week">This week only</option>
                                <option value="phase">All {wk.deload ? "deload" : "build"} weeks in this phase</option>
                                <option value="all">All non-deload weeks</option>
                              </select>
                            </PlanEditForm>
                            {rx && (
                              <PlanEditForm planId={plan.id} op="remove_slot" submitLabel="Remove from this phase" className="mt-1">
                                <input type="hidden" name="slot_id" value={sl.id} /><input type="hidden" name="week" value={wk.week} />
                              </PlanEditForm>
                            )}
                          </details>
                        )}
                      </td>
                      <td>{rx ? `${rx.sets} × ${reps}` : "—"}</td>
                      <td>{rx ? `${rx.rest_sec}s` : "—"}</td>
                      <td>{rx ? `${rx.rpe_min}–${rx.rpe_max}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cardio prescription">
          {t.cardio.removed ? (
            <p className="text-sm text-red-400">Cardio removed{t.cardio.removed_reason ? ` — ${t.cardio.removed_reason}` : ""}.</p>
          ) : (
            <>
              <p className="text-sm">{METS[t.cardio.activity].label} · {t.cardio.intensity}{t.cardio.hr_bpm ? ` · ${t.cardio.zone === "zone2" ? "Zone 2" : "Zone 3"} ${t.cardio.hr_bpm.min}–${t.cardio.hr_bpm.max} bpm (RPE ${t.cardio.rpe}, age-predicted HRmax — estimate)` : ""}</p>
              <p className="text-sm">This week: {cw.sessions} × {cw.minutes} min on {t.cardio.days.slice(0, cw.sessions).map((d) => DAY_NAMES[d]).join(", ")}{cw.sessions > t.cardio.days.length ? " + after lifting" : ""}.</p>
              <div className="mt-2 overflow-x-auto"><table className="table text-xs"><thead><tr><th>Week</th>{t.cardio.weeks.map((w) => <th key={w.week}>{w.week}</th>)}</tr></thead><tbody><tr><td>Sessions × min</td>{t.cardio.weeks.map((w) => <td key={w.week}>{w.sessions}×{w.minutes}</td>)}</tr></tbody></table></div>
            </>
          )}
          {editable && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">Edit cardio</summary>
              <PlanEditForm planId={plan.id} op="cardio" className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <label>From week<input className="input" type="number" name="from_week" min={1} max={plan.parameters.weeks} defaultValue={wk.week} /></label>
                <label>Activity<select className="input" name="activity" defaultValue={t.cardio.activity}>{Object.entries(METS).filter(([k]) => !k.startsWith("resistance") && k !== "mobility").map(([k, v]) => <option key={k} value={k}>{v.label} (MET {v.met})</option>)}</select></label>
                <label>Sessions/week<input className="input" type="number" name="sessions" defaultValue={cw.sessions} /></label>
                <label>Minutes/session<input className="input" type="number" name="minutes" defaultValue={cw.minutes} /></label>
                <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="removed" defaultChecked={t.cardio.removed} /> Remove cardio (requires a reason)</label>
                <input className="input col-span-2" name="removed_reason" placeholder="Reason for removing cardio" defaultValue={t.cardio.removed_reason} />
              </PlanEditForm>
            </details>
          )}
        </Card>
        <Card title="Mobility / recovery">
          <p className="text-sm">{t.mobility.sessions_per_week} × {t.mobility.minutes} min on non-lifting days ({t.mobility.days.map((d) => DAY_NAMES[d]).join(", ")}).</p>
          <ul className="mt-1 list-disc pl-5 text-sm">{t.mobility.flow.map((m) => <li key={m.id}>{m.name}</li>)}</ul>
          {editable && (
            <PlanEditForm planId={plan.id} op="mobility" className="mt-2 flex flex-wrap items-end gap-2 text-sm">
              <label>Sessions/week<input className="input" type="number" name="sessions_per_week" defaultValue={t.mobility.sessions_per_week} /></label>
              <label>Minutes<input className="input" type="number" name="minutes" defaultValue={t.mobility.minutes} /></label>
            </PlanEditForm>
          )}
        </Card>
      </div>
    </div>
  );
}

function Nutrition({ plan, editable, disclaimer, hasGoalWeight }: { plan: PlanRow; editable: boolean; disclaimer: string; hasGoalWeight: boolean }) {
  const n = plan.nutrition;
  const p = plan.parameters;
  const disc = <p className="rounded border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300">{disclaimer}</p>;
  if (!n || n.blocked || !n.targets) return <div className="space-y-3"><Banner tone="red" title="Nutrition guidance not generated">{n?.blocked_reason}</Banner>{disc}</div>;
  const t = n.targets;
  const e = n.energy!;
  const row = (label: string, g: number, pct: number, tol: number) => <tr><td>{label}</td><td className="font-semibold">{g} g</td><td>±{tol} g</td><td>{pct.toFixed(0)}% of calories</td></tr>;
  return (
    <div className="space-y-4">
      {disc}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Daily targets (estimates)">
          <div className="table-wrap"><table className="table">
            <thead><tr><th></th><th>Target</th><th>Tolerance</th><th></th></tr></thead>
            <tbody>
              <tr><td>Calories</td><td className="font-semibold">{fmt.n(t.calories)} kcal</td><td>±{t.tolerance.calories} kcal</td><td>{fmt.n(t.calories - t.tolerance.calories)}–{fmt.n(t.calories + t.tolerance.calories)}</td></tr>
              {row("Protein", t.protein_g, t.protein_pct, t.tolerance.protein_g)}
              {row("Carbohydrate", t.carbs_g, t.carbs_pct, t.tolerance.carbs_g)}
              {row("Fat", t.fat_g, t.fat_pct, t.tolerance.fat_g)}
            </tbody>
          </table></div>
          <p className="mt-2 text-xs text-slate-400">Protein {t.protein_g_per_lb.toFixed(2)} g/lb of {t.reference_weight_lb} lb reference weight. 4P + 4C + 9F = {fmt.n(4 * t.protein_g + 4 * t.carbs_g + 9 * t.fat_g)} kcal.</p>
          <p className="mt-2 text-sm">{n.fiber_text}</p>
          <p className="mt-1 text-sm">{n.hydration_text}</p>
          <p className="mt-1 text-sm">{n.meals_guidance}</p>
          {n.notes.map((x, i) => <p key={i} className="mt-1 text-xs text-slate-400">{x}</p>)}
          {editable && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">Adjust targets (within guardrails)</summary>
              <PlanEditForm planId={plan.id} op="params" className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <input type="hidden" name="start_date" value={p.start_date} />
                <input type="hidden" name="checkpoint_weeks" value={p.checkpoint_weeks.join(",")} />
                <label>Calorie mode<select className="input" name="calorie_mode" defaultValue={p.calorie_mode}><option value="deficit">Deficit / surplus from TDEE</option><option value="fixed">Fixed target</option></select></label>
                <label>Deficit (kcal/day; negative = surplus)<input className="input" type="number" name="deficit" defaultValue={p.deficit} /></label>
                <label>Fixed target (kcal)<input className="input" type="number" name="target_override" defaultValue={p.target_override ?? ""} /></label>
                <label>Protein (g per lb)<input className="input" type="number" step="0.05" name="protein_g_per_lb" defaultValue={p.protein_g_per_lb ?? ""} placeholder={t.protein_g_per_lb.toFixed(2)} /></label>
                <label>Fat (% of calories)<input className="input" type="number" step="1" name="fat_pct" defaultValue={p.fat_pct ?? ""} placeholder={t.fat_pct.toFixed(0)} /></label>
                <label>Reference weight<select className="input" name="reference_weight" defaultValue={p.reference_weight}><option value="current">Current weight</option>{hasGoalWeight && <option value="goal">Goal weight</option>}</select></label>
                <label>Resting equation<select className="input" name="bmr_method" defaultValue={p.bmr_method}><option value="mifflin">Mifflin-St Jeor</option><option value="katch">Katch-McArdle (needs body fat %)</option></select></label>
                <label>Daily activity<select className="input" name="neat_level" defaultValue={p.neat_level}>{Object.entries(NEAT_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label} (×{v.factor})</option>)}</select></label>
                <label>Energy mode<select className="input" name="energy_mode" defaultValue={p.energy_mode}><option value="formula">Formula</option><option value="measured">Measured (wearable TDEE)</option></select></label>
              </PlanEditForm>
            </details>
          )}
        </Card>
        <Card title="Energy balance (estimates)">
          <EnergyTable plan={plan} />
          <p className="mt-2 text-sm"><b>Expected change:</b> {describePrediction(e)}.</p>
          <p className="mt-1 text-xs text-slate-400">Uses 3,500 kcal per lb as a planning approximation only; ±{(e.uncertainty_pct * 100).toFixed(0)}% TDEE uncertainty ({e.uncertainty_pct <= 0.05 ? "calibrated" : e.mode}). Recalibrated from real weigh-ins at checkpoints. Post-exercise afterburn is ignored (conservative).</p>
        </Card>
      </div>
      <Card title="Example days — examples, swap freely">
        {n.example_days.length === 0 ? <Empty>No example days fit inside every band with the allowed foods.</Empty> : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {n.example_days.map((d) => (
              <div key={d.label} className="rounded border border-slate-800 p-3">
                <div className="mb-1 flex justify-between text-sm font-semibold"><span>{d.label}</span><span className="font-normal text-slate-400">{d.totals.calories} kcal · P {d.totals.protein_g} · C {d.totals.carbs_g} · F {d.totals.fat_g} {Object.values(d.within_band).every(Boolean) && <Badge tone="green">in band</Badge>}</span></div>
                {d.meals.map((m, i) => (
                  <div key={i} className="mt-1 text-sm"><b>{m.name}:</b> {m.items.map((it) => `${it.name}: ${it.household} (~${Math.round(it.grams)} g)`).join("; ")}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Food lists">
          {Object.entries(n.food_lists).map(([cat, foods]) => <p key={cat} className="mb-1 text-sm"><b className="capitalize">{cat}:</b> {foods.map((f) => f.name).join(", ")}</p>)}
        </Card>
        <Card title="Swaps">
          {n.swaps.map((s) => (
            <div key={s.category} className="mb-2 text-sm"><b>{s.category}</b><ul className="list-disc pl-5">{s.options.map((o) => <li key={o.name}>{o.name}: {o.household} (~{o.grams} g)</li>)}</ul></div>
          ))}
        </Card>
        <Card title="Grocery staples"><ul className="list-disc pl-5 text-sm">{n.grocery_staples.map((g) => <li key={g}>{g}</li>)}</ul></Card>
      </div>
      {disc}
    </div>
  );
}

function EnergyTable({ plan }: { plan: PlanRow }) {
  const e = plan.nutrition?.energy;
  if (!e) return null;
  const r = (v: number | null) => (v == null ? "—" : fmt.n(v));
  return (
    <div className="table-wrap"><table className="table text-sm">
      <tbody>
        {e.mode === "measured" ? (
          <>
            <tr><td>Measured TDEE (wearable, includes current exercise and food effect)</td><td>{r(e.measured_tdee)}</td></tr>
            <tr><td>+ Planned program exercise (net)</td><td>{r(e.planned_exercise_kcal_per_day)}</td></tr>
            <tr><td>− Current baseline exercise</td><td>{e.baseline_missing ? <Badge tone="red">missing</Badge> : r(e.baseline_exercise_kcal_per_day)}</td></tr>
          </>
        ) : (
          <>
            <tr><td>Resting (BMR)</td><td>{r(e.bmr)}</td></tr>
            <tr><td>Daily activity (non-exercise)</td><td>{r(e.nonexercise_kcal)}</td></tr>
            <tr><td>Strength training (net, avg/day)</td><td>{r(e.strength_kcal_per_week / 7)}</td></tr>
            <tr><td>Cardio (net, avg/day)</td><td>{r(e.cardio_kcal_per_week / 7)}</td></tr>
            <tr><td>Mobility (net, avg/day)</td><td>{r(e.mobility_kcal_per_week / 7)}</td></tr>
            <tr><td>Food effect (TEF)</td><td>{r(e.tef_kcal)}</td></tr>
          </>
        )}
        <tr className="font-semibold"><td>Estimated TDEE</td><td>{r(e.tdee)} <span className="text-xs font-normal text-slate-400">±{(e.uncertainty_pct * 100).toFixed(0)}%</span></td></tr>
        <tr><td>Target intake</td><td>{r(e.target_kcal)}</td></tr>
        <tr><td>Daily balance</td><td>{fmt.signed(e.daily_balance, 0)}</td></tr>
      </tbody>
    </table></div>
  );
}

function Calendar({ plan }: { plan: PlanRow }) {
  const cal = planCalendar(plan.parameters, plan.training);
  return (
    <Card title="Calendar">
      <div className="overflow-x-auto">
        <table className="table text-xs">
          <thead><tr><th>Week</th>{cal[0]?.days.map((d) => <th key={d.date}>{DAY_NAMES[d.weekday]}</th>)}</tr></thead>
          <tbody>
            {cal.map((w) => (
              <tr key={w.week} className={clsx(w.deload && "bg-amber-950/40")}>
                <td className="whitespace-nowrap font-semibold">W{w.week}<div className="font-normal text-slate-400">{w.phase ? PHASES[w.phase as keyof typeof PHASES].label : ""}{w.deload ? " · deload" : ""}</div></td>
                {w.days.map((d) => (
                  <td key={d.date} className="min-w-[8rem]"><div className="text-slate-400">{formatDate(d.date)}</div>{d.items.map((it, i) => <div key={i}>{it}</div>)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Checkpoints({ plan, clientId }: { plan: PlanRow; clientId: string }) {
  const p = plan.parameters;
  return (
    <Card title="Checkpoints">
      <p className="text-sm">Calibration checkpoints at weeks {p.checkpoint_weeks.join(", ") || "—"} (weeks 1–2 are never used for calibration because of water/glycogen shifts). Retests at the end of each deload week. Measurements every 4 weeks.</p>
      {plan.status === "approved" ? <p className="mt-2 text-sm"><Link href={`/clients/${clientId}`}>See the checkpoint timeline and run calibrations on the client page →</Link></p> : <p className="mt-2 text-sm text-slate-400">Checkpoints are scheduled when the plan is approved.</p>}
      {plan.status === "draft" && (
        <PlanEditForm planId={plan.id} op="params" submitLabel="Save checkpoint weeks" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          {(["start_date", "calorie_mode", "deficit", "target_override", "bmr_method", "neat_level", "energy_mode", "reference_weight", "protein_g_per_lb", "fat_pct"] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={String(p[k] ?? "")} />
          ))}
          <label>Checkpoint weeks (comma-separated)<input className="input" name="checkpoint_weeks" defaultValue={p.checkpoint_weeks.join(", ")} /></label>
        </PlanEditForm>
      )}
    </Card>
  );
}
