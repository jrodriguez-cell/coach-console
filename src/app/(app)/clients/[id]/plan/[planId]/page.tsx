import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/server";
import { getClient, getPlan, latestIntake, planOverrides } from "@/lib/data/clients";
import { approvalIssues } from "@/lib/data/approval";
import { loadExercises } from "@/lib/data/libraries";
import { getSettings } from "@/lib/data/settings";
import { Badge, Banner, Card, Collapsible, Empty, fmt, statusTone } from "@/components/ui";
import { ApproveForm, OverrideForm, PlanEditForm } from "@/components/plan-forms";
import { GenerateForm } from "@/components/generate-form";
import { SubmitButton } from "@/components/submit-button";
import { revisePlanAction } from "@/app/actions/plans";
import { GOAL_TEMPLATES } from "@/config/goal-templates";
import { PHASES } from "@/config/training-variables";
import { METS, NEAT_FACTORS } from "@/config/energy";
import { goalLabel, PATTERN_LABEL } from "@/lib/labels";
import { DAY_NAMES, dayOfWeek, formatDate, todayIn } from "@/lib/dates";
import { describePrediction } from "@/lib/energy";
import { blockOfWeek, holdSeconds, isUsable, sessionsInBlock, skillLadder } from "@/lib/training";
import { SKILLS, skillTaggedName } from "@/config/skills";
import { skillSchedule } from "@/lib/skill-schedule";
import { candidateFilter, programDefaults } from "@/lib/generator";
import { FOCUS_LABELS } from "@/config/program-styles";
import type { ProgramDefaults } from "@/components/generate-form";
import { IntakeAnswersSchema } from "@/lib/intake";
import { planCalendar } from "@/lib/calendar";
import type { PlanRow } from "@/lib/data/types";
import type { NutritionPlan } from "@/lib/plan-types";
import { currentPlanWeek } from "@/lib/client-week";
import { ShareWeek } from "@/components/share-week";
import { plannedItems, plannedItemsForWeek, recordFor, type ItemKind, type SessionRecord } from "@/lib/schedule";
import { ExportFileButton } from "@/components/export-file-button";
import { SessionResults, type ResultExercise } from "@/components/session-results";

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
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/clients/${client.id}`, label: client.name }}
        eyebrow="Plan"
        title={`Version ${plan.version}`}
        badge={<Badge tone={plan.status === "approved" ? "green" : plan.status === "draft" ? "yellow" : "gray"}>{plan.status === "draft" ? "Draft" : plan.status}</Badge>}
        meta={<>{goalLabel(plan.goal_category)} · generated {formatDate(plan.generated_at.slice(0, 10))}{plan.approved_at ? ` · approved ${formatDate(plan.approved_at.slice(0, 10))}` : ""} · {plan.training?.selection_source === "llm" ? "exercise picks drafted by Claude from the library" : "library-default exercise picks"}</>}
        actions={
          <>
            <ExportFileButton url={`/api/plans/${plan.id}/export/xlsx`} label="Plan Excel" />
            <ExportFileButton url={`/api/plans/${plan.id}/export/pdf`} label="Plan PDF" />
            {plan.status !== "draft" && (
              <form action={revisePlanAction.bind(null, plan.id)}><SubmitButton className="w-full sm:w-auto">Create revision</SubmitButton></form>
            )}
            {editable && <ApproveForm planId={plan.id} />}
          </>
        }
      />

      {plan.status === "draft" && (
        <Banner tone={issues.length ? "yellow" : "green"} title={issues.length ? "DRAFT — not approved. Before you can approve:" : "DRAFT — ready to approve."}>
          {issues.length > 0 && <ul className="list-disc pl-5">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>}
          <p className="mt-1 text-xs">Exports and week sheets are labeled DRAFT until approval.</p>
        </Banner>
      )}


      <div className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b border-fg/15 px-3 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link key={t} href={`${base}?tab=${t}`} className={clsx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium capitalize no-underline hover:no-underline", t === tab ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg")}>
            {t}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {plan.training?.clearance_notes && (
            <Banner tone="red" title="Physician clearance notes">
              <pre className="whitespace-pre-wrap font-sans">{plan.training.clearance_notes}</pre>
            </Banner>
          )}

          <GuardrailPanel plan={plan} overrides={overrides} editable={editable} />
          <Overview plan={plan} editable={editable} clientId={client.id} purpose={client.purpose_text} intakeGoal={intake?.answers.primary_goal} program={intake ? programDefaults(plan.goal_category, intake.answers, plan.parameters, client.purpose_text) : undefined} />
        </>
      )}
      {tab === "training" && <Training plan={plan} editable={editable} week={Number(searchParams.week) || currentPlanWeek(plan.parameters, todayIn())} fileBase={client.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")} base={base} candidates={await swapCandidates(db, plan, intake?.answers)} results={await weekResults(db, plan, Math.min(Math.max(Number(searchParams.week) || currentPlanWeek(plan.parameters, todayIn()), 1), plan.parameters.weeks))} />}
      {tab === "nutrition" && <Nutrition plan={plan} editable={editable} disclaimer={settings.disclaimer} hasGoalWeight={Boolean(intake?.answers.goal_weight_lb)} />}
      {tab === "calendar" && <Calendar plan={plan} done={await doneByDate(db, plan)} />}
      {tab === "checkpoints" && <Checkpoints plan={plan} clientId={client.id} />}
    </div>
  );
}

interface WeekResult { date: string; key: string; name: string; exercises: ResultExercise[]; notes: string; logged: boolean }

/** This week's scheduled strength sessions with what's been logged and last time's numbers. */
async function weekResults(db: ReturnType<typeof createClient>, plan: PlanRow, week: number): Promise<WeekResult[] | null> {
  const t = plan.training;
  if (!t || plan.status !== "approved") return null;
  const items = plannedItemsForWeek(plan.parameters, t, week).filter((i) => i.kind === "strength");
  if (!items.length) return [];
  const wk = t.weeks[week - 1];
  const from = items[0].date;
  const [{ data: thisWeek }, { data: before }] = await Promise.all([
    db.from("workout_sessions").select("id, date, planned_session_key, notes").eq("client_id", plan.client_id).gte("date", from).lte("date", items[items.length - 1].date),
    db.from("workout_sessions").select("id, date").eq("client_id", plan.client_id).lt("date", from).order("date", { ascending: false }).limit(40),
  ]);
  type S = { id: string; date: string; planned_session_key?: string | null; notes?: string | null };
  const cur = (thisWeek ?? []) as S[];
  const prev = (before ?? []) as S[];
  const ids = [...cur, ...prev].map((x) => x.id);
  const { data: setData } = ids.length ? await db.from("set_logs").select("session_id, exercise_id, set_number, weight_lb, reps").in("session_id", ids) : { data: [] };
  const sets = (setData ?? []) as { session_id: string; exercise_id: string; set_number: number; weight_lb: number | null; reps: number | null }[];
  const dateOf = new Map([...cur, ...prev].map((x) => [x.id, x.date]));
  // Most recent earlier sets per exercise.
  const lastBy = new Map<string, { date: string; sets: typeof sets }>();
  for (const sl of sets) {
    const d = dateOf.get(sl.session_id)!;
    if (cur.some((c) => c.id === sl.session_id)) continue;
    const have = lastBy.get(sl.exercise_id);
    if (!have || d > have.date) lastBy.set(sl.exercise_id, { date: d, sets: [sl] });
    else if (d === have.date) have.sets.push(sl);
  }
  const fmtSet = (x: { weight_lb: number | null; reps: number | null }, unit: string) => `${x.weight_lb != null ? `${Number(x.weight_lb)} lb × ` : ""}${x.reps ?? "?"}${unit === "seconds" ? " s" : ""}`;
  return items.map((it) => {
    const session = t.sessions.find((x) => x.key === it.key)!;
    const logged = cur.find((c) => c.date === it.date && c.planned_session_key === it.key);
    const mine = logged ? sets.filter((x) => x.session_id === logged.id) : [];
    const exercises = session.slots.filter((sl) => wk?.prescriptions[sl.id]).map((sl): ResultExercise => {
      const rx = wk.prescriptions[sl.id];
      const reps = sl.unit === "seconds" ? `${holdSeconds(rx)[0]}–${holdSeconds(rx)[1]} s` : `${rx.reps_min}–${rx.reps_max}`;
      const last = lastBy.get(sl.exercise.id);
      const best = last ? [...last.sets].sort((a, b) => (Number(b.weight_lb ?? 0) - Number(a.weight_lb ?? 0)) || ((b.reps ?? 0) - (a.reps ?? 0)))[0] : null;
      return {
        id: sl.exercise.id,
        name: skillTaggedName(sl.exercise.name, sl),
        unit: sl.unit,
        sets: rx.sets,
        target: `${rx.sets} × ${reps} · RPE ${rx.rpe_min === rx.rpe_max ? rx.rpe_min : `${rx.rpe_min}–${rx.rpe_max}`}`,
        last: best ? `${fmtSet(best, sl.unit)} (${formatDate(last!.date).replace(/, \d{4}$/, "")})` : null,
        lastWeight: best?.weight_lb != null ? Number(best.weight_lb) : null,
        logged: mine.filter((x) => x.exercise_id === sl.exercise.id).map((x) => ({ set_number: x.set_number, weight_lb: x.weight_lb != null ? Number(x.weight_lb) : null, reps: x.reps })),
      };
    });
    return { date: it.date, key: it.key, name: session.name, exercises, notes: logged?.notes ?? "", logged: mine.length > 0 };
  });
}

async function swapCandidates(db: ReturnType<typeof createClient>, plan: PlanRow, answers: unknown) {
  if (!plan.training || !answers) return {};
  const intake = IntakeAnswersSchema.parse(answers);
  const lib = await loadExercises(db);
  const f = candidateFilter(intake);
  const out: Record<string, { id: string; name: string }[]> = {};
  for (const s of plan.training.sessions) for (const sl of s.slots) out[sl.id] = (sl.role === "skill" && sl.skill ? skillLadder(sl.skill, lib, f) : lib.filter((e) => e.pattern === sl.pattern && isUsable(e, f))).map((e) => ({ id: e.id, name: e.name }));
  return out;
}

function GuardrailPanel({ plan, overrides, editable }: { plan: PlanRow; overrides: { rule_key: string; reason: string }[]; editable: boolean }) {
  const flags = plan.guardrail_flags ?? [];
  if (!flags.length) return null;
  const notOk = flags.filter((f) => f.status !== "ok");
  return (
    <Card title="Guardrails" actions={<span className="text-xs text-muted">{flags.length - notOk.length} ok · {notOk.filter((f) => f.status === "warn").length} warn · {notOk.filter((f) => f.status === "blocked").length} blocked</span>}>
      <ul className="space-y-3 text-sm">
        {notOk.map((f) => {
          const ov = overrides.filter((o) => o.rule_key === f.rule_key);
          return (
            <li key={f.rule_key} className="space-y-1.5 border-b border-fg/10 pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(f.status)}>{f.status}</Badge><span className="font-semibold">{f.label}</span>{f.value ? <span className="text-muted">{f.value}</span> : null}</div>
              <p className="text-muted">{f.message}</p>
              {f.status === "warn" && (ov.length ? <div className="text-xs text-ok">Override: {ov.map((o) => o.reason).join("; ")}</div> : editable && <OverrideForm planId={plan.id} ruleKey={f.rule_key} />)}
              {f.status === "blocked" && <div className="text-xs text-alert">Cannot be overridden. Change the plan inputs.</div>}
            </li>
          );
        })}
      </ul>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show passing checks</summary>
        <ul className="mt-2 space-y-1.5">
          {flags.filter((f) => f.status === "ok").map((f) => <li key={f.rule_key} className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{f.label}</span>{f.value ? <span className="text-muted">{f.value}</span> : null}</li>)}
        </ul>
      </details>
    </Card>
  );
}

function Overview({ plan, editable, clientId, purpose, intakeGoal, program }: { plan: PlanRow; editable: boolean; clientId: string; purpose: string | null; intakeGoal?: string; program?: ProgramDefaults }) {
  const p = plan.parameters;
  const tpl = GOAL_TEMPLATES[plan.goal_category];
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {plan.training?.split_reasons?.length ? (
        <Card title={`Why ${plan.training.split_label.toLowerCase()}`} className="lg:col-span-2">
          <ul className="list-disc space-y-1 pl-5 text-sm">{plan.training.split_reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {editable && <p className="mt-2 text-xs text-muted">To change it, open “Change program style” under Parameters.</p>}
        </Card>
      ) : null}
      <Card title="Programming guidelines">
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
            {plan.training && <tr><td>Program style</td><td>{plan.training.split_label}{plan.training.focus?.length ? ` · focus: ${plan.training.focus.map((f) => FOCUS_LABELS[f]).join(", ")}` : ""}{plan.training.block_rotations ? " · accessories change each block" : ""}</td></tr>}
            <tr><td>Phases (4-week blocks)</td><td>{p.phase_sequence.map((ph) => PHASES[ph].label).join(" → ")}</td></tr>
            <tr><td>Calorie target mode</td><td>{p.calorie_mode === "fixed" ? `fixed at ${p.target_override} kcal` : `${p.deficit >= 0 ? "deficit" : "surplus"} of ${Math.abs(p.deficit)} kcal/day`}</td></tr>
            <tr><td>Energy model</td><td>{p.energy_mode} mode · {p.bmr_method === "katch" ? "Katch-McArdle" : "Mifflin-St Jeor"} · {NEAT_FACTORS[p.neat_level].label}</td></tr>
            <tr><td>Checkpoints</td><td>weeks {p.checkpoint_weeks.join(", ") || "—"}</td></tr>
          </tbody>
        </table></div>
        {editable && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Change program style, focus or structure (regenerates a new draft)</summary>
            <div className="mt-2"><GenerateForm clientId={clientId} fromPlanId={plan.id} defaults={{ start_date: p.start_date, weeks: p.weeks, days_per_week: p.days_per_week }} program={program} label="Regenerate draft" /></div>
            <p className="mt-1 text-xs text-muted">The current draft is archived and kept as a version.</p>
          </details>
        )}
      </Card>
    </div>
  );
}

/** The skill goal, called out: ladder with the weeks each step is scheduled, and this week's skill work. */
function SkillCard({ t, week }: { t: NonNullable<PlanRow["training"]>; week: NonNullable<PlanRow["training"]>["weeks"][number] }) {
  if (!t.skill) return null;
  const def = SKILLS[t.skill];
  const ladder = skillSchedule(t);
  const names = ladder.map((x) => x.name);
  const current = sessionsInBlock(t.sessions, blockOfWeek(week.week)).flatMap((ss) => ss.slots).find((sl) => sl.role === "skill");
  const curIdx = current ? names.indexOf(current.exercise.name) : -1;
  const sessions = sessionsInBlock(t.sessions, blockOfWeek(week.week));
  const rx = (id: string, unit: "reps" | "seconds") => {
    const p = week.prescriptions[id];
    return p ? `${p.sets} × ${unit === "seconds" ? `${holdSeconds(p)[0]}–${holdSeconds(p)[1]} s` : `${p.reps_min}–${p.reps_max}`}` : null;
  };
  return (
    <Card title={`${def.label} progression`} actions={<span className="caps">Skill goal</span>}>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {names.map((n, i) => (
          <li key={n} className={clsx("border p-2.5", i === curIdx ? "border-fg bg-fg text-canvas" : i < curIdx ? "border-fg/20 text-muted" : "border-fg/30")}>
            <div className={clsx("caps", i === curIdx && "text-canvas/80")}>{i < curIdx ? "✓ " : ""}Step {i + 1}{i === names.length - 1 ? " · goal" : ""}</div>
            <div className="mt-1 text-sm font-semibold leading-snug">{n}</div>
            <div className={clsx("mt-0.5 text-xs", i === curIdx ? "text-canvas/80" : "text-muted")}>{ladder[i].weeks ? `Weeks ${ladder[i].weeks}` : i < curIdx ? "Done before this plan" : "Next plan, or move up early"}</div>
          </li>
        ))}
      </ol>
      <p className="muted mt-3">{def.progressCue} To move up early, swap the step in the session below.</p>
      <h3 className="mt-4">{def.label} work in week {week.week}</h3>
      <div className="mt-1 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((ss) => {
          const items = ss.slots.filter((sl) => sl.skill && week.prescriptions[sl.id]);
          if (!items.length) return null;
          return (
            <div key={ss.key} className="border-t border-fg/10 py-2">
              <div className="caps mb-1">{ss.name}</div>
              <ul className="space-y-0.5 text-sm">
                {items.map((sl) => <li key={sl.id}><span className={sl.role === "skill" ? "font-semibold" : ""}>{sl.exercise.name}</span> <span className="text-muted">· {rx(sl.id, sl.unit)}{sl.role === "skill" ? " · first, while fresh" : ""}</span></li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Training({ plan, editable, week, base, candidates, fileBase, results }: { plan: PlanRow; editable: boolean; week: number; base: string; candidates: Record<string, { id: string; name: string }[]>; fileBase: string; results: WeekResult[] | null }) {
  const t = plan.training;
  if (!t) return <Banner tone="red" title="Training not generated">{plan.nutrition?.training_blocked_reason ?? "Refer out before generating training."}</Banner>;
  const wk = t.weeks[Math.min(Math.max(week, 1), t.weeks.length) - 1];
  const cw = t.cardio.weeks[wk.week - 1];
  return (
    <div className="space-y-4">
      <nav aria-label="Plan week" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {t.weeks.map((w) => (
          <Link key={w.week} href={`${base}?tab=training&week=${w.week}`} aria-current={w.week === wk.week ? "page" : undefined} className={clsx("btn btn-sm shrink-0", w.week === wk.week && "btn-primary")}>
            W{w.week}{w.deload ? " ·D" : ""}
          </Link>
        ))}
      </nav>
      <div id="send" className="scroll-mt-24"><Card title={`Send week ${wk.week}`}>
        <p className="muted mb-3">Send this week&apos;s workouts. Your client fills in weight and reps as they train (Excel, or marks up the PDF), then sends it back. Import the Excel on their <Link href={`/clients/${plan.client_id}?tab=log`}>Log tab</Link> to save every set. Leaves out calories and your notes.{plan.status !== "approved" ? " Marked DRAFT until the plan is approved." : ""}</p>
        <ShareWeek planId={plan.id} week={wk.week} fileBase={fileBase} />
      </Card></div>
      <p className="text-sm">
        <b>Week {wk.week}</b> · {PHASES[wk.phase].label}{wk.deload ? " · DELOAD (≈40% fewer sets, stop at RPE 5–6)" : ""}{wk.retest ? " · retest at the last session" : ""}{t.block_rotations ? ` · block ${blockOfWeek(wk.week) + 1} exercises` : ""} · {t.split_label}, lifting on {t.lifting_days.map((d) => DAY_NAMES[d]).join(", ")}
      </p>
      <SkillCard t={t} week={wk} />
      {results && results.length > 0 && (() => {
        const today = todayIn();
        const openIdx = results.findIndex((r) => r.date <= today && !r.logged);
        return (
          <Card title={`Log week ${wk.week} results`} actions={<span className="text-sm text-muted">{results.filter((r) => r.logged).length}/{results.length} logged</span>}>
            <p className="muted mb-2">Enter weight and reps (seconds for holds) for each set. Leave weight blank for bodyweight. Saving ticks the workout off and feeds strength progress and adherence. The fillable Excel still works too.</p>
            <div className="divide-y divide-fg/10">
              {results.map((r, i) => (
                <Collapsible key={`${r.date}-${r.key}`} defaultOpen={i === openIdx} title={`${DAY_NAMES[dayOfWeek(r.date)]} ${formatDate(r.date).replace(/, \d{4}$/, "")} · ${r.name}`} hint={r.logged ? "✓ logged" : r.date > today ? "upcoming" : "not logged yet"}>
                  <SessionResults clientId={plan.client_id} planId={plan.id} date={r.date} sessionKey={r.key} exercises={r.exercises} notes={r.notes} editable={r.date <= today} />
                </Collapsible>
              ))}
            </div>
          </Card>
        );
      })()}
      <h3 className="pt-2">Program for week {wk.week}</h3>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {sessionsInBlock(t.sessions, blockOfWeek(wk.week)).map((s, si) => (
          <Collapsible key={s.key} defaultOpen={si === 0} title={s.name} hint={`${s.slots.filter((sl) => wk.prescriptions[sl.id]).length} exercises · ≈${wk.session_minutes[s.key]} min + warm-up`}>
            <div className="table-wrap"><table className="table table-stack">
              <thead><tr><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>RPE</th></tr></thead>
              <tbody>
                {s.slots.map((sl) => {
                  const rx = wk.prescriptions[sl.id];
                  const reps = rx ? (sl.unit === "seconds" ? `${holdSeconds(rx)[0]}–${holdSeconds(rx)[1]} s` : `${rx.reps_min}–${rx.reps_max}`) : "";
                  return (
                    <tr key={sl.id} className={clsx(!rx && "opacity-50")}>
                      <td data-primary>
                        <div className="font-medium">
                          {sl.skill && <span className={clsx("mr-1.5 inline-block px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em]", sl.role === "skill" ? "bg-fg text-canvas" : "border border-fg/50")}>{SKILLS[sl.skill].label}{sl.role === "skill" ? "" : " prep"}</span>}
                          {sl.exercise.name} <span className="text-xs font-normal text-muted">{sl.role === "skill" ? "skill step" : `${PATTERN_LABEL[sl.pattern]} · ${sl.role}`}{sl.focus ? ` · ${FOCUS_LABELS[sl.focus].toLowerCase()} focus` : ""}</span>
                        </div>
                        {sl.regression && <div className="text-xs text-muted">↓ Regression: {sl.regression.name}</div>}
                        {sl.progression && <div className="text-xs text-muted">↑ Progression: {sl.progression.name}</div>}
                        {sl.note && <div className="text-xs italic text-muted">{sl.note}</div>}
                        {!rx && <div className="text-xs text-muted">Not in this block (session-length limit)</div>}
                        {editable && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-fg">Edit</summary>
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
                      <td data-label="Sets × reps">{rx ? `${rx.sets} × ${reps}` : "—"}</td>
                      <td data-label="Rest">{rx ? `${rx.rest_sec}s` : "—"}</td>
                      <td data-label="RPE">{rx ? (rx.rpe_min === rx.rpe_max ? rx.rpe_min : `${rx.rpe_min}–${rx.rpe_max}`) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </Collapsible>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card title="Cardio prescription">
          {t.cardio.removed ? (
            <p className="text-sm text-alert">Cardio removed{t.cardio.removed_reason ? ` — ${t.cardio.removed_reason}` : ""}.</p>
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

function MacroSplit({ t }: { t: NonNullable<NutritionPlan["targets"]> }) {
  // Share of calories; each segment named directly (no colour-only identity).
  const parts = [
    { label: "Protein", pct: t.protein_pct, cls: "bg-fg" },
    { label: "Carbs", pct: t.carbs_pct, cls: "bg-fg/55" },
    { label: "Fat", pct: t.fat_pct, cls: "bg-fg/25" },
  ];
  return (
    <figure>
      <div className="flex h-3 w-full gap-0.5" role="img" aria-label={parts.map((x) => `${x.label} ${Math.round(x.pct)}%`).join(", ")}>
        {parts.map((x) => <div key={x.label} className={x.cls} style={{ width: `${x.pct}%` }} />)}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-xs text-muted">
        {parts.map((x) => <span key={x.label}>{x.label} {Math.round(x.pct)}%</span>)}
      </figcaption>
    </figure>
  );
}

function Nutrition({ plan, editable, disclaimer, hasGoalWeight }: { plan: PlanRow; editable: boolean; disclaimer: string; hasGoalWeight: boolean }) {
  const n = plan.nutrition;
  const p = plan.parameters;
  const disc = <p className="text-xs text-muted">{disclaimer}</p>;
  if (!n || n.blocked || !n.targets) return <div className="space-y-3"><Banner tone="red" title="Nutrition guidance not generated">{n?.blocked_reason}</Banner>{disc}</div>;
  const t = n.targets;
  const e = n.energy!;
  const perMeal = Math.round(t.protein_g / n.meals_per_day);
  const macro = (label: string, g: number, tol: number) => (
    <div className="border-t border-fg/15 pt-2">
      <div className="caps">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{g}<span className="text-base font-medium"> g</span></div>
      <div className="text-xs text-muted">± {tol} g</div>
    </div>
  );
  return (
    <div className="space-y-8">
      <Card title="Daily targets">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="caps">Calories</div>
            <div className="mt-1 text-5xl font-semibold leading-none tracking-tight tabular-nums">{fmt.n(t.calories)}</div>
            <div className="mt-1 text-sm text-muted">kcal a day · aim for {fmt.n(t.calories - t.tolerance.calories)}–{fmt.n(t.calories + t.tolerance.calories)}</div>
            <p className="mt-3 text-sm"><b>Expected change:</b> {describePrediction(e)}.</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {macro("Protein", t.protein_g, t.tolerance.protein_g)}
              {macro("Carbs", t.carbs_g, t.tolerance.carbs_g)}
              {macro("Fat", t.fat_g, t.tolerance.fat_g)}
            </div>
            <MacroSplit t={t} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel"><div className="caps">Meals</div><p className="mt-1 text-sm">{n.meals_per_day} a day, about <b>{perMeal} g protein</b> each.</p></div>
        <div className="panel"><div className="caps">Fiber</div><p className="mt-1 text-sm"><b>{t.fiber_g} g</b> a day from vegetables, fruit, legumes and whole grains.</p></div>
        <div className="panel"><div className="caps">Water</div><p className="mt-1 text-sm">{t.water ? <>About <b>{t.water.from_drinks_fl_oz} fl oz</b> from drinks ({t.water.total_fl_oz} fl oz total fluids); more around training and heat.</> : n.hydration_text}</p></div>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3"><h2>Example days</h2><span className="text-xs text-muted">Examples only; swap foods freely.</span></div>
        {n.example_days.length === 0 ? <Empty>No example days fit inside every target with the allowed foods.</Empty> : (
          <div className="divide-y divide-fg/10 border-y border-fg/10">
            {n.example_days.map((d, i) => (
              <Collapsible key={d.label} defaultOpen={i === 0} title={d.label.replace(/\s*[—-]\s*example.*$/i, "")} hint={`${d.totals.calories} kcal · P ${d.totals.protein_g} · C ${d.totals.carbs_g} · F ${d.totals.fat_g}${Object.values(d.within_band).every(Boolean) ? " · on target" : ""}`}>
                <dl className="divide-y divide-fg/10">
                  {d.meals.map((m, j) => (
                    <div key={j} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8rem_1fr]">
                      <dt className="caps pt-0.5">{m.name}</dt>
                      <dd className="text-sm">
                        <ul className="space-y-0.5">{m.items.map((it, k) => <li key={k}>{it.name} <span className="text-muted">· {it.household} (~{Math.round(it.grams)} g)</span></li>)}</ul>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Collapsible>
            ))}
          </div>
        )}
      </section>

      <div className="divide-y divide-fg/10 border-y border-fg/10">
        <Collapsible title="Food guide" hint="Foods that fit, swaps and a grocery list">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <h3 className="mb-2">Foods that fit</h3>
              {Object.entries(n.food_lists).map(([cat, foods]) => (
                <div key={cat} className="mb-2"><div className="caps mb-1 capitalize">{cat}</div><p className="text-sm">{foods.map((f) => f.name).join(" · ")}</p></div>
              ))}
            </div>
            <div>
              <h3 className="mb-2">Swaps</h3>
              {n.swaps.map((sw) => (
                <div key={sw.category} className="mb-2"><div className="caps mb-1">{sw.category}</div><ul className="space-y-0.5 text-sm">{sw.options.map((o) => <li key={o.name}>{o.name} <span className="text-muted">· {o.household} (~{o.grams} g)</span></li>)}</ul></div>
              ))}
            </div>
            <div>
              <h3 className="mb-2">Grocery staples</h3>
              <ul className="space-y-0.5 text-sm">{n.grocery_staples.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          </div>
        </Collapsible>
        <Collapsible title="How the numbers are worked out" hint="Energy balance, assumptions and adjustments">
          <EnergyTable plan={plan} />
          <p className="mt-2 text-xs text-muted">Protein {t.protein_g_per_lb.toFixed(2)} g per lb of {t.reference_weight_lb} lb reference weight · 4P + 4C + 9F = {fmt.n(4 * t.protein_g + 4 * t.carbs_g + 9 * t.fat_g)} kcal. Uses 3,500 kcal per lb as a planning approximation; ±{(e.uncertainty_pct * 100).toFixed(0)}% TDEE uncertainty ({e.uncertainty_pct <= 0.05 ? "calibrated" : e.mode}). Recalibrated from weigh-ins at checkpoints.</p>
          {n.notes.map((x, i) => <p key={i} className="mt-1 text-xs text-muted">{x}</p>)}
          {editable && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">Adjust targets (within guardrails)</summary>
              <PlanEditForm planId={plan.id} op="params" className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <input type="hidden" name="start_date" value={p.start_date} />
                <input type="hidden" name="checkpoint_weeks" value={p.checkpoint_weeks.join(",")} />
                <label><span className="label">Calorie mode</span><select className="input" name="calorie_mode" defaultValue={p.calorie_mode}><option value="deficit">Deficit / surplus from TDEE</option><option value="fixed">Fixed target</option></select></label>
                <label><span className="label">Deficit (kcal/day; negative = surplus)</span><input className="input" type="number" name="deficit" defaultValue={p.deficit} /></label>
                <label><span className="label">Fixed target (kcal)</span><input className="input" type="number" name="target_override" defaultValue={p.target_override ?? ""} /></label>
                <label><span className="label">Protein (g per lb)</span><input className="input" type="number" step="0.05" name="protein_g_per_lb" defaultValue={p.protein_g_per_lb ?? ""} placeholder={t.protein_g_per_lb.toFixed(2)} /></label>
                <label><span className="label">Fat (% of calories)</span><input className="input" type="number" step="1" name="fat_pct" defaultValue={p.fat_pct ?? ""} placeholder={t.fat_pct.toFixed(0)} /></label>
                <label><span className="label">Reference weight</span><select className="input" name="reference_weight" defaultValue={p.reference_weight}><option value="current">Current weight</option>{hasGoalWeight && <option value="goal">Goal weight</option>}</select></label>
                <label><span className="label">Resting equation</span><select className="input" name="bmr_method" defaultValue={p.bmr_method}><option value="mifflin">Mifflin-St Jeor</option><option value="katch">Katch-McArdle (needs body fat %)</option></select></label>
                <label><span className="label">Daily activity</span><select className="input" name="neat_level" defaultValue={p.neat_level}>{Object.entries(NEAT_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label} (×{v.factor})</option>)}</select></label>
                <label><span className="label">Energy mode</span><select className="input" name="energy_mode" defaultValue={p.energy_mode}><option value="formula">Formula</option><option value="measured">Measured (wearable TDEE)</option></select></label>
              </PlanEditForm>
            </details>
          )}
        </Collapsible>
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
        <tr className="font-semibold"><td>Estimated TDEE</td><td>{r(e.tdee)} <span className="text-xs font-normal text-muted">±{(e.uncertainty_pct * 100).toFixed(0)}%</span></td></tr>
        <tr><td>Target intake</td><td>{r(e.target_kcal)}</td></tr>
        <tr><td>Daily balance</td><td>{fmt.signed(e.daily_balance, 0)}</td></tr>
      </tbody>
    </table></div>
  );
}

/** Which kinds of workout were done on each date (for greying out calendar items). */
async function doneByDate(db: ReturnType<typeof createClient>, plan: PlanRow): Promise<Record<string, ItemKind[]>> {
  if (plan.status !== "approved" || !plan.training) return {};
  const { data } = await db.from("workout_sessions").select("date, planned_session_key, status, source").eq("client_id", plan.client_id).gte("date", plan.parameters.start_date);
  const recs = (data ?? []) as SessionRecord[];
  const out: Record<string, ItemKind[]> = {};
  for (const it of plannedItems(plan.parameters, plan.training, plan.parameters.start_date, todayIn())) if (recordFor(it, recs)) (out[it.date] ??= []).push(it.kind);
  return out;
}

const itemKind = (label: string): ItemKind | null => (label.startsWith("Strength:") ? "strength" : label.startsWith("Cardio:") ? "cardio" : label.startsWith("Mobility") ? "mobility" : null);

function CalItem({ label, done }: { label: string; done: boolean }) {
  return <span className={clsx(done && "text-muted line-through decoration-fg/30")}>{done ? "✓ " : ""}{label}</span>;
}

function Calendar({ plan, done }: { plan: PlanRow; done: Record<string, ItemKind[]> }) {
  const cal = planCalendar(plan.parameters, plan.training);
  const isDone = (date: string, label: string) => { const k = itemKind(label); return Boolean(k && done[date]?.includes(k)); };
  return (
    <Card title="Calendar" actions={plan.status === "approved" ? <span className="text-xs text-muted">✓ = done. Check workouts off on the client page.</span> : undefined}>
      {/* Phones: one block per week, listing only days with something on. */}
      <ol className="space-y-5 sm:hidden">
        {cal.map((w) => (
          <li key={w.week} className={clsx("border-t border-fg/15 pt-3", w.deload && "border-fg/40")}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3>Week {w.week}</h3>
              <span className="text-xs text-muted">{w.phase ? PHASES[w.phase as keyof typeof PHASES].label : ""}{w.deload ? " · deload" : ""}</span>
            </div>
            <ul className="space-y-2 text-sm">
              {w.days.filter((d) => d.items.length).map((d) => (
                <li key={d.date} className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <span className="text-muted">{DAY_NAMES[d.weekday]} {formatDate(d.date).replace(/, \d{4}$/, "")}</span>
                  <span>{d.items.map((it, i) => <span key={i}>{i > 0 && " · "}<CalItem label={it} done={isDone(d.date, it)} /></span>)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="hidden overflow-x-auto sm:block">
        <table className="table text-xs">
          <thead><tr><th>Week</th>{cal[0]?.days.map((d) => <th key={d.date}>{DAY_NAMES[d.weekday]}</th>)}</tr></thead>
          <tbody>
            {cal.map((w) => (
              <tr key={w.week} className={clsx(w.deload && "bg-fg/5")}>
                <td className="whitespace-nowrap font-semibold">W{w.week}<div className="font-normal text-muted">{w.phase ? PHASES[w.phase as keyof typeof PHASES].label : ""}{w.deload ? " · deload" : ""}</div></td>
                {w.days.map((d) => (
                  <td key={d.date} className="min-w-[8rem]"><div className="text-muted">{formatDate(d.date)}</div>{d.items.map((it, i) => <div key={i}><CalItem label={it} done={isDone(d.date, it)} /></div>)}</td>
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
      {plan.status === "approved" ? <p className="mt-2 text-sm"><Link href={`/clients/${clientId}`}>See the checkpoint timeline and run calibrations on the client page →</Link></p> : <p className="mt-2 text-sm text-muted">Checkpoints are scheduled when the plan is approved.</p>}
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
