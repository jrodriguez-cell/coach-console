import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientBundle } from "@/lib/data/clients";
import { Badge, Banner, Card, Empty, Field, TabBar, fmt } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/page-header";
import { ImportWeekForm } from "@/components/import-week-form";
import { GenerateForm } from "@/components/generate-form";
import { CheckinForm, MeasurementsForm, TestResultForm, WeighInForm } from "@/components/quick-add";
import { TaskList } from "@/components/task-list";
import { logContactAction, recordClearanceAction, recordReferralAction, updateClientAction } from "@/app/actions/clients";
import { activeReferOutFlags, blockedSections, clearanceIssue, REFER_OUT_FLAGS } from "@/lib/intake";
import { GOAL_CATEGORIES } from "@/config/goal-templates";
import { goalLabel, STATUS_TONE } from "@/lib/labels";
import { addDays, formatDate, todayIn, weekStart } from "@/lib/dates";
import { describePrediction } from "@/lib/energy";
import clsx from "clsx";
import { WeekChecklist } from "@/components/week-checklist";
import { GoalProgress } from "@/components/goal-progress";
import { goalOverview, type GoalOverview } from "@/lib/goal-progress";
import { loadProgressData, summarize } from "@/lib/data/progress-data";
import { getSettings } from "@/lib/data/settings";
import { planWeekOf, weekChecklist, type ChecklistDay, type SessionRecord } from "@/lib/schedule";
import { programDefaults } from "@/lib/generator";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; wk?: string } }) {
  const db = createClient();
  const b = await getClientBundle(db, params.id);
  if (!b) notFound();
  const { client, intake, clearance, plan } = b;
  const flags = activeReferOutFlags(intake?.refer_out_flags);
  const blocked = blockedSections(intake?.refer_out_flags, b.referrals);
  const clrIssue = clearanceIssue(Boolean(intake?.parq_flagged), clearance ? { status: clearance.status, notes: [clearance.notes, clearance.exercise_limits, clearance.hr_ceiling, clearance.rpe_ceiling, clearance.activities_to_avoid].filter(Boolean).join(" "), reason: clearance.reason } : null);
  const { data: benchmarks } = await db.from("benchmarks").select("id, name, unit").eq("client_id", client.id).order("created_at");
  const t = plan?.nutrition?.targets;
  const e = plan?.nutrition?.energy;
  const today = todayIn();
  const tab = (["overview", "log", "history", "details"] as const).find((t) => t === searchParams.tab) ?? "overview";
  // This week's workouts to check off (approved plans only).
  const live = plan?.status === "approved" && plan.training ? { plan, training: plan.training } : null;
  const thisWeek = live ? Math.min(Math.max(planWeekOf(live.plan.parameters.start_date, today), 1), live.plan.parameters.weeks) : 0;
  const shownWeek = live ? Math.min(Math.max(Number(searchParams.wk) || thisWeek, 1), live.plan.parameters.weeks) : 0;
  let checklist: ChecklistDay[] = [];
  if (live && tab === "overview") {
    const ws = weekStart(live.plan.parameters.start_date, shownWeek);
    const { data: recs } = await db.from("workout_sessions").select("date, planned_session_key, status, source").eq("client_id", client.id).gte("date", ws).lte("date", addDays(ws, 6));
    checklist = weekChecklist(live.plan.parameters, live.training, shownWeek, (recs ?? []) as SessionRecord[]);
  }
  // Progress toward the goal from training and nutrition inputs.
  let goal: GoalOverview | null = null;
  if (tab === "overview" && plan) {
    const settings = await getSettings(db);
    const pd = (await loadProgressData(db, [client])).get(client.id);
    if (pd) goal = goalOverview(pd, summarize(pd, today, settings.task_thresholds), today);
  }
  const doneCount = checklist.flatMap((d) => d.items).filter((i) => i.state).length;
  const dueCount = checklist.flatMap((d) => d.items).length;

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        eyebrow={goalLabel(client.goal_category)}
        title={client.name}
        badge={<Badge tone={STATUS_TONE[client.status]}>{client.status}</Badge>}
        meta={
          <>
            {[client.email, client.phone, client.start_date ? `Starts ${formatDate(client.start_date)}` : null].filter(Boolean).join(" · ")}
            {client.purpose_text && <p className="mt-1 text-fg">“{client.purpose_text}”</p>}
          </>
        }
        actions={
          <>
            {plan && <Link className="btn btn-primary" href={`/clients/${client.id}/plan/${plan.id}`}>Open plan</Link>}
            <Link className="btn" href={`/clients/${client.id}/progress`}>Progress</Link>
            <Link className="btn" href={`/clients/${client.id}?tab=log`}>Log data</Link>
          </>
        }
      />

      <TabBar
        tabs={[{ key: "overview", label: "Overview" }, { key: "log", label: "Log" }, { key: "history", label: "History" }, { key: "details", label: "Details" }]}
        active={tab}
        href={(k) => `/clients/${client.id}${k === "overview" ? "" : `?tab=${k}`}`}
      />

      {tab === "overview" && (
        <>
      {/* Refer-out banners */}
      {flags.map((f) => {
        const handled = b.referrals.filter((r) => r.flag === f);
        const isBlocking = [...blocked.nutrition, ...blocked.training].includes(f);
        const section = REFER_OUT_FLAGS[f].blocks;
        return (
          <Banner key={f} tone={isBlocking ? "red" : "yellow"} title={`REFER OUT — ${REFER_OUT_FLAGS[f].label}${section ? (isBlocking ? ` · ${section} generation blocked` : ` · ${section} unlocked`) : ""}`}>
            <p>{REFER_OUT_FLAGS[f].hint} Advice about this is never auto-generated.</p>
            {intake?.refer_out_flags.notes && <p className="mt-1">Screening notes: {intake.refer_out_flags.notes}</p>}
            {handled.map((h) => <p key={h.id} className="mt-1">✔ {formatDate(h.handled_at.slice(0, 10))}: {h.handled_note}</p>)}
            <form action={recordReferralAction.bind(null, client.id)} className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="flag" value={f} />
              <input className="input" name="handled_note" placeholder='How it was handled, e.g. "referred to RD", "physician clearance received"' required />
              <SubmitButton className="btn-sm">Record</SubmitButton>
            </form>
          </Banner>
        );
      })}

      {/* PAR-Q / clearance */}
      {intake?.parq_flagged && clrIssue && (
        <Banner tone={clrIssue ? "red" : "green"} title={clrIssue ? "NEEDS PHYSICIAN CLEARANCE" : `Physician clearance: ${clearance?.status.replace("_", " ")}`}>
          {clrIssue && <p>{clrIssue} The plan cannot be approved until this is recorded.</p>}
          {clearance && (
            <p className="mt-1">
              Latest: {clearance.status.replace("_", " ")}
              {clearance.requested_at ? ` · requested ${formatDate(clearance.requested_at)}` : ""}
              {clearance.received_at ? ` · received ${formatDate(clearance.received_at)}` : ""}
              {clearance.exercise_limits ? ` · limits: ${clearance.exercise_limits}` : ""}
              {clearance.hr_ceiling ? ` · HR ≤ ${clearance.hr_ceiling}` : ""}
              {clearance.rpe_ceiling ? ` · RPE ≤ ${clearance.rpe_ceiling}` : ""}
              {clearance.activities_to_avoid ? ` · avoid: ${clearance.activities_to_avoid}` : ""}
              {clearance.notes ? ` · ${clearance.notes}` : ""}
              {clearance.reason ? ` · reason: ${clearance.reason}` : ""}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">Record clearance status</summary>
            <form action={recordClearanceAction.bind(null, client.id)} className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Field label="Status">
                <select className="input" name="status" defaultValue="received">
                  <option value="pending">Pending (requested)</option>
                  <option value="received">Received (with notes)</option>
                  <option value="not_required">Not required (with reason)</option>
                </select>
              </Field>
              <Field label="Requested"><input className="input" type="date" name="requested_at" defaultValue={clearance?.requested_at ?? today} /></Field>
              <Field label="Received"><input className="input" type="date" name="received_at" defaultValue={today} /></Field>
              <Field label="Exercise limits"><input className="input" name="exercise_limits" /></Field>
              <Field label="HR ceiling (bpm)"><input className="input" type="number" name="hr_ceiling" /></Field>
              <Field label="RPE ceiling"><input className="input" type="number" step="0.5" name="rpe_ceiling" /></Field>
              <Field label="Activities to avoid" className="md:col-span-3"><input className="input" name="activities_to_avoid" /></Field>
              <Field label="Notes" className="md:col-span-3"><input className="input" name="notes" /></Field>
              <Field label="Reason (if not required)" className="md:col-span-3"><input className="input" name="reason" /></Field>
              <div><SubmitButton className="btn-sm btn-primary">Save clearance</SubmitButton></div>
            </form>
          </details>
        </Banner>
      )}

      {!intake && <Banner tone="blue" title="Intake needed">Complete the intake (including PAR-Q) before generating a plan. <Link href={`/clients/${client.id}/intake`}>Start intake →</Link></Banner>}
          {/* One full-width column: goal, what needs doing, this week, the plan. */}
          <div className="space-y-8">
          {goal && (
            <Card title="Progress to goal" actions={<Link className="text-sm" href={`/clients/${client.id}/progress`}>Details</Link>}>
              <GoalProgress g={goal} />
            </Card>
          )}
          <Card title="Tasks"><TaskList tasks={b.tasks} showClient={false} clientName={client.name} columns /></Card>
          {live && (
            <Card
              title={shownWeek === thisWeek ? "This week" : `Week ${shownWeek}`}
              actions={
                <span className="flex items-center gap-1 text-sm">
                  <span className="mr-1 text-muted">{doneCount}/{dueCount} done</span>
                  <Link aria-label="Previous week" className={clsx("btn btn-sm", shownWeek <= 1 && "pointer-events-none opacity-40")} href={`/clients/${client.id}?wk=${shownWeek - 1}`}>‹</Link>
                  {shownWeek !== thisWeek && <Link className="btn btn-sm" href={`/clients/${client.id}`}>Now</Link>}
                  <Link aria-label="Next week" className={clsx("btn btn-sm", shownWeek >= live.plan.parameters.weeks && "pointer-events-none opacity-40")} href={`/clients/${client.id}?wk=${shownWeek + 1}`}>›</Link>
                </span>
              }
            >
              <p className="muted mb-1">Week {shownWeek} of {live.plan.parameters.weeks}. Tap a workout when it&apos;s done; it greys out and counts toward adherence. Imported sheets tick themselves.</p>
              <WeekChecklist key={shownWeek} clientId={client.id} planId={live.plan.id} days={checklist} today={today} clientName={client.name} columns />
            </Card>
          )}
          <Card title="Current plan">
            {plan ? (
              <div className="space-y-2 text-sm">
                <p>
                  Version {plan.version} · <Badge tone={plan.status === "approved" ? "green" : "yellow"}>{plan.status === "approved" ? "Approved" : "DRAFT"}</Badge> · {goalLabel(plan.goal_category)} · starts {formatDate(plan.parameters.start_date)} · {plan.parameters.weeks} weeks
                </p>
                {t ? (
                  <p>
                    Targets (estimates): <b>{fmt.n(t.calories)} kcal</b> (±{t.tolerance.calories}) · P {t.protein_g} g · C {t.carbs_g} g · F {t.fat_g} g
                    {e && <><br />Expected change: {describePrediction(e)}</>}
                  </p>
                ) : (
                  <p className="text-alert">{plan.nutrition?.blocked_reason ?? "Nutrition not generated."}</p>
                )}
                {plan.training ? <p>{plan.training.split_label}, {plan.training.lifting_days.length} days/week · cardio {plan.training.cardio.removed ? "removed" : `${plan.training.cardio.weeks[0]?.sessions}×${plan.training.cardio.weeks[0]?.minutes} min`}</p> : <p className="text-alert">{plan.nutrition?.training_blocked_reason ?? "Training not generated."}</p>}
              </div>
            ) : (
              <Empty>{intake ? "No plan yet. Generate a draft below; it uses the intake answers." : <>No plan yet. <Link href={`/clients/${client.id}/intake`}>Complete the intake</Link> first, then generate a draft.</>}</Empty>
            )}
            {intake && (
              <details className="mt-3" open={!plan}>
                <summary className="cursor-pointer text-sm font-medium">{plan ? "Generate a new draft (keeps versions)" : "Generate a draft plan"}</summary>
                <div className="mt-2"><GenerateForm clientId={client.id} defaults={{ start_date: client.start_date ?? today }} program={programDefaults(client.goal_category, intake.answers, plan?.parameters, client.purpose_text)} /></div>
              </details>
            )}
            {b.plans.length > 1 && (
              <p className="mt-2 text-xs text-muted">
                Versions: {b.plans.map((p) => <Link key={p.id} href={`/clients/${client.id}/plan/${p.id}`} className="mr-2">v{p.version} ({p.status})</Link>)}
              </p>
            )}
          </Card>
          </div>
        </>
      )}

      {tab === "log" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
          <Card title="Quick add">
            <div className="divide-y divide-fg/15 border-y border-fg/15">
              {[
                { key: "weigh", title: "Weigh-in", open: true, body: <WeighInForm clientId={client.id} /> },
                { key: "check", title: "Check-in", open: false, body: <CheckinForm clientId={client.id} /> },
                { key: "test", title: "Test result", open: false, body: <TestResultForm clientId={client.id} benchmarks={benchmarks ?? []} /> },
                { key: "meas", title: "Measurements", open: false, body: <MeasurementsForm clientId={client.id} /> },
              ].map((q) => (
                <details key={q.key} open={q.open} className="group">
                  <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                    <h3>{q.title}</h3>
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="pb-4">{q.body}</div>
                </details>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link href={`/clients/${client.id}/session`}>Log a workout with sets →</Link>
              <Link href={`/clients/${client.id}/entry`}>Open the data grid →</Link>
            </div>
          </Card>

            <Card title="Import a client's workout sheet"><ImportWeekForm clientId={client.id} /></Card>
          </div>
          <Card title="Contact log">
            <form action={logContactAction.bind(null, client.id)} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="date" name="date" defaultValue={today} />
                <select className="input" name="channel" defaultValue="text">
                  <option value="text">Text</option><option value="email">Email</option><option value="call">Call</option><option value="in_person">In person</option>
                </select>
              </div>
              <input className="input" name="summary" placeholder="Summary" />
              <SubmitButton className="btn-sm btn-primary">Log contact</SubmitButton>
            </form>
            {b.contacts.length === 0 ? <Empty>No contact logged yet. Log texts, calls and check-ins above so outreach reminders stay accurate.</Empty> : (
              <ul className="space-y-1 text-sm">
                {b.contacts.map((c) => <li key={c.id}><b>{formatDate(c.date)}</b> · {c.channel.replace("_", " ")}{c.summary ? ` — ${c.summary}` : ""}</li>)}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-6">
          <Card title="Checkpoint timeline">
            {b.checkpoints.length === 0 ? (
              <Empty>Checkpoints are created when a plan is approved.</Empty>
            ) : (
              <div className="table-wrap"><table className="table table-stack">
                <thead><tr><th>Date</th><th>Week</th><th>Kind</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {b.checkpoints.map((c) => (
                    <tr key={c.id}>
                      <td data-primary>{formatDate(c.due_date)}</td>
                      <td data-label="Week">{c.week}</td>
                      <td data-label="Kind">{c.kind === "review" ? "Calibration / review" : c.kind}</td>
                      <td data-label="Status">{c.completed_at ? <Badge tone="green">done{c.result && "decision" in c.result ? `: ${String(c.result.decision).replace("_", " ")}` : ""}</Badge> : c.due_date < today ? <Badge tone="red">due</Badge> : <Badge>upcoming</Badge>}</td>
                      <td>{c.kind === "review" && !c.completed_at && <Link className="btn btn-sm" href={`/clients/${client.id}/calibrate?checkpoint=${c.id}`}>Run calibration</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
            {b.calibrations.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-semibold">Calibration decisions</h3>
                <ul className="text-sm">
                  {b.calibrations.map((c) => (
                    <li key={c.id}>
                      {formatDate(c.created_at.slice(0, 10))}: <b>{c.decision.replace("_", " ")}</b>
                      {c.observed_lb_per_week != null && ` · observed ${fmt.signed(Number(c.observed_lb_per_week), 2)} lb/wk vs planned ${fmt.signed(Number(c.planned_lb_per_week), 2)}`}
                      {c.adherence_pct != null && ` · adherence ${fmt.n(Number(c.adherence_pct))}%`}
                      {c.applied_adjustment_kcal ? ` · applied ${fmt.signed(Number(c.applied_adjustment_kcal), 0)} kcal` : ""}
                      {c.trainer_decision_note && ` — ${c.trainer_decision_note}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Guardrail override history">
            {b.overrides.length === 0 ? <Empty>No overrides.</Empty> : (
              <div className="table-wrap"><table className="table table-stack">
                <thead><tr><th>Date</th><th>Plan</th><th>Rule</th><th>Value</th><th>Reason</th></tr></thead>
                <tbody>
                  {b.overrides.map((o) => (
                    <tr key={o.id}><td data-primary>{formatDate(o.created_at.slice(0, 10))}</td><td data-label="Plan">v{o.plan_version}</td><td data-label="Rule">{o.rule_key}</td><td data-label="Value">{o.override_value ?? "—"}</td><td data-label="Reason" data-block>{o.reason}</td></tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Card>
        </div>
      )}

      {tab === "details" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Client details">
            <div>
              <form action={updateClientAction.bind(null, client.id)} className="space-y-3">
                <Field label="Name"><input className="input" name="name" defaultValue={client.name} required /></Field>
                <Field label="Email"><input className="input" name="email" type="email" defaultValue={client.email ?? ""} /></Field>
                <Field label="Phone"><input className="input" name="phone" type="tel" defaultValue={client.phone ?? ""} /></Field>
                <Field label="Status"><select className="input" name="status" defaultValue={client.status}>
                  {["prospect", "active", "paused", "completed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select></Field>
                <Field label="Goal"><select className="input" name="goal_category" defaultValue={client.goal_category}>
                  {GOAL_CATEGORIES.map((g) => <option key={g} value={g}>{goalLabel(g)}</option>)}
                </select></Field>
                <Field label="Start date"><input className="input" type="date" name="start_date" defaultValue={client.start_date ?? ""} /></Field>
                <Field label="Purpose (client’s words)"><textarea className="input" name="purpose_text" defaultValue={client.purpose_text ?? ""} rows={2} /></Field>
                <SubmitButton className="btn-primary w-full sm:w-auto">Save details</SubmitButton>
              </form>
            </div>
          </Card>
          <div className="space-y-6">
      {/* PAR-Q / clearance */}
      {intake?.parq_flagged && !clrIssue && (
        <Banner tone={clrIssue ? "red" : "green"} title={clrIssue ? "NEEDS PHYSICIAN CLEARANCE" : `Physician clearance: ${clearance?.status.replace("_", " ")}`}>
          {clrIssue && <p>{clrIssue} The plan cannot be approved until this is recorded.</p>}
          {clearance && (
            <p className="mt-1">
              Latest: {clearance.status.replace("_", " ")}
              {clearance.requested_at ? ` · requested ${formatDate(clearance.requested_at)}` : ""}
              {clearance.received_at ? ` · received ${formatDate(clearance.received_at)}` : ""}
              {clearance.exercise_limits ? ` · limits: ${clearance.exercise_limits}` : ""}
              {clearance.hr_ceiling ? ` · HR ≤ ${clearance.hr_ceiling}` : ""}
              {clearance.rpe_ceiling ? ` · RPE ≤ ${clearance.rpe_ceiling}` : ""}
              {clearance.activities_to_avoid ? ` · avoid: ${clearance.activities_to_avoid}` : ""}
              {clearance.notes ? ` · ${clearance.notes}` : ""}
              {clearance.reason ? ` · reason: ${clearance.reason}` : ""}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">Record clearance status</summary>
            <form action={recordClearanceAction.bind(null, client.id)} className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Field label="Status">
                <select className="input" name="status" defaultValue="received">
                  <option value="pending">Pending (requested)</option>
                  <option value="received">Received (with notes)</option>
                  <option value="not_required">Not required (with reason)</option>
                </select>
              </Field>
              <Field label="Requested"><input className="input" type="date" name="requested_at" defaultValue={clearance?.requested_at ?? today} /></Field>
              <Field label="Received"><input className="input" type="date" name="received_at" defaultValue={today} /></Field>
              <Field label="Exercise limits"><input className="input" name="exercise_limits" /></Field>
              <Field label="HR ceiling (bpm)"><input className="input" type="number" name="hr_ceiling" /></Field>
              <Field label="RPE ceiling"><input className="input" type="number" step="0.5" name="rpe_ceiling" /></Field>
              <Field label="Activities to avoid" className="md:col-span-3"><input className="input" name="activities_to_avoid" /></Field>
              <Field label="Notes" className="md:col-span-3"><input className="input" name="notes" /></Field>
              <Field label="Reason (if not required)" className="md:col-span-3"><input className="input" name="reason" /></Field>
              <div><SubmitButton className="btn-sm btn-primary">Save clearance</SubmitButton></div>
            </form>
          </details>
        </Banner>
      )}

            <Card title="Intake">
              <p className="muted mb-3">{intake ? `Last updated ${formatDate(intake.submitted_at.slice(0, 10))}.` : "No intake yet."}</p>
              <Link className="btn" href={`/clients/${client.id}/intake`}>{intake ? "Update intake" : "Start intake"}</Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
