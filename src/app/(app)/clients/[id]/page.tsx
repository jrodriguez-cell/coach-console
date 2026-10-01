import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientBundle } from "@/lib/data/clients";
import { Badge, Banner, Card, Empty, Field, fmt } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { GenerateForm } from "@/components/generate-form";
import { CheckinForm, MeasurementsForm, TestResultForm, WeighInForm } from "@/components/quick-add";
import { TaskList } from "@/components/task-list";
import { logContactAction, recordClearanceAction, recordReferralAction, updateClientAction } from "@/app/actions/clients";
import { activeReferOutFlags, blockedSections, clearanceIssue, REFER_OUT_FLAGS } from "@/lib/intake";
import { GOAL_CATEGORIES } from "@/config/goal-templates";
import { goalLabel, STATUS_TONE } from "@/lib/labels";
import { formatDate, todayIn } from "@/lib/dates";
import { describePrediction } from "@/lib/energy";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: { id: string } }) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/clients" className="text-sm">← Clients</Link>
          <h1 className="flex items-center gap-2">{client.name} <Badge tone={STATUS_TONE[client.status]}>{client.status}</Badge></h1>
          <p className="muted">{goalLabel(client.goal_category)}{client.email ? ` · ${client.email}` : ""}{client.phone ? ` · ${client.phone}` : ""}{client.start_date ? ` · start ${formatDate(client.start_date)}` : ""}</p>
          {client.purpose_text && <p className="text-sm">“{client.purpose_text}”</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href={`/clients/${client.id}/intake`}>{intake ? "Update intake" : "Start intake"}</Link>
          <Link className="btn" href={`/clients/${client.id}/progress`}>Progress</Link>
          <Link className="btn" href={`/clients/${client.id}/entry`}>Data entry grid</Link>
          <Link className="btn" href={`/clients/${client.id}/session`}>Log session</Link>
          <Link className="btn" href={`/clients/${client.id}/calibrate`}>Calibrate now</Link>
        </div>
      </div>

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
            <form action={recordReferralAction.bind(null, client.id)} className="mt-2 flex gap-2">
              <input type="hidden" name="flag" value={f} />
              <input className="input" name="handled_note" placeholder='How it was handled, e.g. "referred to RD", "physician clearance received"' required />
              <SubmitButton className="btn-sm">Record</SubmitButton>
            </form>
          </Banner>
        );
      })}

      {/* PAR-Q / clearance */}
      {intake?.parq_flagged && (
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Current plan" actions={plan && <Link className="btn btn-sm" href={`/clients/${client.id}/plan/${plan.id}`}>Open plan</Link>}>
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
                  <p className="text-red-700">{plan.nutrition?.blocked_reason ?? "Nutrition not generated."}</p>
                )}
                {plan.training ? <p>{plan.training.split_label}, {plan.training.lifting_days.length} days/week · cardio {plan.training.cardio.removed ? "removed" : `${plan.training.cardio.weeks[0]?.sessions}×${plan.training.cardio.weeks[0]?.minutes} min`}</p> : <p className="text-red-700">{plan.nutrition?.training_blocked_reason ?? "Training not generated."}</p>}
              </div>
            ) : (
              <Empty>No plan yet.</Empty>
            )}
            {intake && (
              <details className="mt-3" open={!plan}>
                <summary className="cursor-pointer text-sm font-medium">{plan ? "Generate a new draft (keeps versions)" : "Generate a draft plan"}</summary>
                <div className="mt-2"><GenerateForm clientId={client.id} defaults={{ start_date: client.start_date ?? today }} /></div>
              </details>
            )}
            {b.plans.length > 1 && (
              <p className="mt-2 text-xs text-slate-500">
                Versions: {b.plans.map((p) => <Link key={p.id} href={`/clients/${client.id}/plan/${p.id}`} className="mr-2">v{p.version} ({p.status})</Link>)}
              </p>
            )}
          </Card>

          <Card title="Quick add">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><h3 className="mb-1 text-sm font-semibold">Weigh-in</h3><WeighInForm clientId={client.id} /></div>
              <div><h3 className="mb-1 text-sm font-semibold">Test result</h3><TestResultForm clientId={client.id} benchmarks={benchmarks ?? []} /></div>
              <div><h3 className="mb-1 text-sm font-semibold">Check-in</h3><CheckinForm clientId={client.id} /></div>
              <div><h3 className="mb-1 text-sm font-semibold">Measurements</h3><MeasurementsForm clientId={client.id} /><p className="mt-2 text-sm"><Link href={`/clients/${client.id}/session`}>Log a session with sets →</Link></p></div>
            </div>
          </Card>

          <Card title="Checkpoint timeline">
            {b.checkpoints.length === 0 ? (
              <Empty>Checkpoints are created when a plan is approved.</Empty>
            ) : (
              <table className="table">
                <thead><tr><th>Date</th><th>Week</th><th>Kind</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {b.checkpoints.map((c) => (
                    <tr key={c.id}>
                      <td>{formatDate(c.due_date)}</td>
                      <td>{c.week}</td>
                      <td>{c.kind === "review" ? "Calibration / review" : c.kind}</td>
                      <td>{c.completed_at ? <Badge tone="green">done{c.result && "decision" in c.result ? `: ${String(c.result.decision).replace("_", " ")}` : ""}</Badge> : c.due_date < today ? <Badge tone="red">due</Badge> : <Badge>upcoming</Badge>}</td>
                      <td>{c.kind === "review" && !c.completed_at && <Link className="btn btn-sm" href={`/clients/${client.id}/calibrate?checkpoint=${c.id}`}>Run calibration</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <table className="table">
                <thead><tr><th>Date</th><th>Plan</th><th>Rule</th><th>Value</th><th>Reason</th></tr></thead>
                <tbody>
                  {b.overrides.map((o) => (
                    <tr key={o.id}><td>{formatDate(o.created_at.slice(0, 10))}</td><td>v{o.plan_version}</td><td>{o.rule_key}</td><td>{o.override_value ?? "—"}</td><td>{o.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Tasks"><TaskList tasks={b.tasks} showClient={false} /></Card>
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
            {b.contacts.length === 0 ? <Empty>No contact logged.</Empty> : (
              <ul className="space-y-1 text-sm">
                {b.contacts.map((c) => <li key={c.id}><b>{formatDate(c.date)}</b> · {c.channel.replace("_", " ")}{c.summary ? ` — ${c.summary}` : ""}</li>)}
              </ul>
            )}
          </Card>
          <Card title="Client details">
            <details>
              <summary className="cursor-pointer text-sm">Edit</summary>
              <form action={updateClientAction.bind(null, client.id)} className="mt-2 space-y-2">
                <input className="input" name="name" defaultValue={client.name} required />
                <input className="input" name="email" defaultValue={client.email ?? ""} placeholder="Email" />
                <input className="input" name="phone" defaultValue={client.phone ?? ""} placeholder="Phone" />
                <select className="input" name="status" defaultValue={client.status}>
                  {["prospect", "active", "paused", "completed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="input" name="goal_category" defaultValue={client.goal_category}>
                  {GOAL_CATEGORIES.map((g) => <option key={g} value={g}>{goalLabel(g)}</option>)}
                </select>
                <input className="input" type="date" name="start_date" defaultValue={client.start_date ?? ""} />
                <textarea className="input" name="purpose_text" defaultValue={client.purpose_text ?? ""} rows={2} />
                <SubmitButton className="btn-sm">Save</SubmitButton>
              </form>
            </details>
          </Card>
        </div>
      </div>
    </div>
  );
}
