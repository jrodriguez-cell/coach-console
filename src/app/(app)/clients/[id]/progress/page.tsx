import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/data/clients";
import { getSettings } from "@/lib/data/settings";
import { loadMetricDefs, loadProgressData, summarize } from "@/lib/data/progress-data";
import { volumeRows, weightRows } from "@/lib/data/progress-view";
import { Badge, Card, Empty, Field, fmt, Stat, type Tone } from "@/components/ui";
import { BarSeries, SeriesChart, WeightChart } from "@/components/charts";
import { SubmitButton } from "@/components/submit-button";
import { createBenchmarkAction, deleteBenchmarkAction, updateBenchmarkAction } from "@/app/actions/entries";
import { WEIGHT_STATUS_LABEL, progressionReadiness, type WeightStatus } from "@/lib/progress";
import { MEASUREMENT_SITES } from "@/config/metrics";
import { formatDate, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<WeightStatus, Tone> = { on_track: "green", slightly_behind: "yellow", behind: "red", ahead: "blue", no_data: "gray" };
const BM_TONE = { achieved: "green", on_track: "green", behind: "red", no_target: "gray", no_data: "gray" } as const;

export default async function ClientProgressPage({ params }: { params: { id: string } }) {
  const db = createClient();
  const client = await getClient(db, params.id);
  if (!client) notFound();
  const settings = await getSettings(db);
  const today = todayIn();
  const [data, defs] = await Promise.all([loadProgressData(db, [client]), loadMetricDefs(db)]);
  const d = data.get(client.id)!;
  const s = summarize(d, today, settings.task_thresholds);
  const w = s.weight;
  const repsMaxFor = (exerciseId: string): number | null => {
    const t = d.plan?.training;
    if (!t || s.week == null) return null;
    const wk = t.weeks[Math.max(0, Math.min(t.weeks.length, s.week) - 1)];
    for (const sess of t.sessions) for (const sl of sess.slots) if (sl.exercise.id === exerciseId && wk?.prescriptions[sl.id]) return wk.prescriptions[sl.id].reps_max;
    return null;
  };
  const customDefs = defs.filter((m) => !m.is_core && m.active && m.show_in_charts && m.type !== "text" && (m.applies_to.includes("all") || m.applies_to.includes(client.goal_category)));
  const bySite = (site: string) => d.measurements.filter((m) => m.site === site).map((m) => ({ date: m.date, value: m.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/clients/${client.id}`} className="text-sm">← {client.name}</Link>
          <h1>Progress — {client.name}</h1>
          <p className="muted">{s.meta ? `Week ${s.week} of ${s.meta.weeks}` : "No approved plan yet"} · all expenditure and predicted-change figures are estimates</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href={`/clients/${client.id}/entry`}>Enter data</Link>
          <a className="btn" href={`/api/clients/${client.id}/progress-report`}>Progress report PDF</a>
        </div>
      </div>

      {/* 1. Weight */}
      <Card title="Weight" actions={w && <Badge tone={STATUS_TONE[w.status]}>{WEIGHT_STATUS_LABEL[w.status]}</Badge>}>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Stat label="Latest" value={w?.latest ? `${w.latest.value} lb` : "—"} sub={w?.latest ? formatDate(w.latest.date) : undefined} />
          <Stat label="7-day trend" value={w?.latestTrend != null ? `${w.latestTrend.toFixed(1)} lb` : "—"} sub={w?.plannedNow != null ? `planned ${w.plannedNow.toFixed(1)} ± ${w.tolerance.toFixed(1)}` : undefined} />
          <Stat label="Cumulative change" value={w?.cumulativeChange != null ? `${fmt.signed(w.cumulativeChange)} lb` : "—"} />
          <Stat label="To goal" value={w?.lbsToGoal != null ? `${w.lbsToGoal.toFixed(1)} lb` : "—"} />
          <Stat label="Rate (last 4 wks)" value={w?.observedLbPerWeek != null ? `${fmt.signed(w.observedLbPerWeek, 2)} lb/wk` : "—"} sub={s.meta ? `planned ${fmt.signed(s.meta.plannedLbPerWeek, 2)} (estimate)` : undefined} />
        </div>
        <WeightChart rows={weightRows(d, s)} />
        <p className="mt-1 text-xs text-stone">Planned trajectory and range come from the plan&apos;s energy model (3,500 kcal/lb planning approximation) — a prediction, not a guarantee.</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 5. Adherence */}
        <Card title={`Adherence (last ${settings.task_thresholds.adherenceWindowDays} days)`}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Overall adherence" value={fmt.pct(s.adherence14)} sub={s.adherenceSource.replace(/_/g, " ")} />
            <Stat label="Sessions" value={`${s.sessions14.completed} / ${s.sessions14.scheduled}`} sub={fmt.pct(s.sessions14.pct)} />
            <Stat label="Cardio minutes" value={fmt.n(s.cardio14.actual)} sub={s.cardio14.planned != null ? `planned ${fmt.n(s.cardio14.planned)}` : undefined} />
            <Stat label="Last check-in" value={s.lastCheckin ? formatDate(s.lastCheckin) : "—"} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div><h3 className="text-sm font-semibold">Sleep (hrs)</h3><SeriesChart points={d.metrics.sleep_hrs ?? []} unit="hrs" height={120} /></div>
            <div><h3 className="text-sm font-semibold">Energy (1–10)</h3><SeriesChart points={d.metrics.energy_1_10 ?? []} height={120} domain={[1, 10]} /></div>
          </div>
        </Card>

        {/* 2. Measurements */}
        <Card title="Measurements (in)">
          {d.measurements.length === 0 ? <Empty>No measurements yet.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Site</th><th>Baseline</th><th>Latest</th><th>Change</th></tr></thead>
              <tbody>
                {MEASUREMENT_SITES.map((site) => {
                  const pts = bySite(site);
                  if (!pts.length) return null;
                  return <tr key={site}><td className="capitalize">{site}</td><td>{pts[0].value} <span className="text-xs text-stone">{formatDate(pts[0].date)}</span></td><td>{pts.at(-1)!.value} <span className="text-xs text-stone">{formatDate(pts.at(-1)!.date)}</span></td><td>{fmt.signed(pts.at(-1)!.value - pts[0].value)}</td></tr>;
                })}
              </tbody>
            </table></div>
          )}
          {d.intake?.answers.body_fat_pct != null && <p className="mt-2 text-sm">Body fat at intake: {d.intake.answers.body_fat_pct}%</p>}
          {bySite("waist").length > 1 && <div className="mt-2"><h3 className="text-sm font-semibold">Waist</h3><SeriesChart points={bySite("waist")} unit="in" height={120} /></div>}
        </Card>
      </div>

      {/* 3. Strength */}
      <Card title="Strength (estimated 5RM, Epley)">
        {s.lifts.length === 0 ? <Empty>Log sessions with sets to track lifts.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Lift</th><th>Baseline 5RM</th><th>Latest 5RM</th><th>% of baseline</th><th>PRs</th><th>Next session</th></tr></thead>
            <tbody>
              {s.lifts.map((l) => {
                const lastDate = l.history.at(-1)?.date;
                const lastSets = d.sets.filter((x) => x.exercise_id === l.exercise_id && x.date === lastDate);
                const top = repsMaxFor(l.exercise_id);
                const ready = top ? progressionReadiness(lastSets, top) : null;
                return (
                  <tr key={l.exercise_id}>
                    <td>{l.exercise_name}</td>
                    <td>{fmt.n(l.baseline5rm)} lb</td>
                    <td>{fmt.n(l.latest5rm)} lb</td>
                    <td>{l.flagLow ? <Badge tone="red">{fmt.pct(l.pctOfBaseline)} — below {settings.task_thresholds.strengthRetentionPct}%</Badge> : fmt.pct(l.pctOfBaseline)}</td>
                    <td>{l.prs.length ? l.prs.map((p) => formatDate(p.date)).join(", ") : "—"}</td>
                    <td>{ready === "add_weight" ? <Badge tone="green">Add weight</Badge> : ready === "rpe_not_logged" ? <span className="text-xs">hit top reps; log RPE to confirm</span> : ready === "not_yet" ? "Same weight" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        <p className="mt-1 text-xs text-stone">e1RM = weight × (1 + reps/30), adding reps in reserve (10 − RPE) when RPE is logged; 5RM = e1RM ÷ (1 + 5/30). Double progression: when every set hits the top of the rep range at RPE 8 or easier, add weight next session.</p>
      </Card>

      {/* 4. Benchmarks */}
      <Card title="Benchmarks and goals">
        {s.benchmarks.length === 0 ? <Empty>No benchmarks yet.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Benchmark</th><th>Baseline</th><th>Target</th><th>Target date</th><th>Current</th><th>% of the way</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {s.benchmarks.map((b) => (
                <tr key={b.id}>
                  <td>{b.name} <span className="text-xs text-stone">{b.unit} · {b.direction === "higher_better" ? "higher is better" : "lower is better"}</span></td>
                  <td colSpan={3}>
                    <form action={updateBenchmarkAction.bind(null, client.id, b.id)} className="flex gap-1">
                      <input className="input w-20" type="number" step="any" name="baseline" defaultValue={b.baseline ?? ""} />
                      <input className="input w-20" type="number" step="any" name="target" defaultValue={b.target ?? ""} />
                      <input className="input w-36" type="date" name="target_date" defaultValue={b.target_date ?? ""} />
                      <button className="btn btn-sm">Save</button>
                    </form>
                  </td>
                  <td>{fmt.n(b.current, 1)}</td>
                  <td>{b.pct != null ? `${Math.round(b.pct)}%${b.expectedPct != null ? ` (expected ${Math.round(b.expectedPct)}%)` : ""}` : "—"}</td>
                  <td><Badge tone={BM_TONE[b.status]}>{b.status.replace("_", " ")}</Badge></td>
                  <td><form action={deleteBenchmarkAction.bind(null, client.id, b.id)}><button className="btn btn-sm">Remove</button></form></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium">Add benchmark</summary>
          <form action={createBenchmarkAction.bind(null, client.id)} className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Field label="Name"><input className="input" name="name" required /></Field>
            <Field label="Category"><select className="input" name="category">{["body", "strength", "cardio", "skill", "mobility", "sport", "habit"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Unit"><input className="input" name="unit" /></Field>
            <Field label="Direction"><select className="input" name="direction"><option value="higher_better">Higher is better</option><option value="lower_better">Lower is better</option></select></Field>
            <Field label="Baseline"><input className="input" type="number" step="any" name="baseline" /></Field>
            <Field label="Target"><input className="input" type="number" step="any" name="target" /></Field>
            <Field label="Target date"><input className="input" type="date" name="target_date" /></Field>
            <Field label="Linked custom metric"><select className="input" name="metric_id" defaultValue=""><option value="">—</option>{defs.filter((m) => !m.is_core).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
            <div><SubmitButton className="btn-sm btn-primary">Add</SubmitButton></div>
          </form>
        </details>
      </Card>

      {/* 6. Volume and log */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Weekly training volume (lb × reps)"><BarSeries points={volumeRows(d)} unit="lb·reps" /></Card>
        <Card title="Training log">
          {d.sessions.length === 0 ? <Empty>No sessions logged.</Empty> : (
            <div className="table-wrap"><table className="table text-xs">
              <thead><tr><th>Date</th><th>Session</th><th>Status</th><th>Sets</th></tr></thead>
              <tbody>
                {[...d.sessions].reverse().slice(0, 15).map((ss) => (
                  <tr key={ss.id}>
                    <td>{formatDate(ss.date)}</td><td>{ss.planned_session_key ?? "—"}</td><td>{ss.status}</td>
                    <td>{d.sets.filter((x) => x.session_id === ss.id).map((x) => `${x.exercise_name} ${x.weight_lb ?? "bw"}×${x.reps ?? "?"}${x.rpe ? `@${x.rpe}` : ""}${x.is_test ? " (test)" : ""}`).join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      </div>

      {customDefs.length > 0 && (
        <Card title="Custom metrics">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {customDefs.map((m) => <div key={m.id}><h3 className="text-sm font-semibold">{m.label}</h3><SeriesChart points={d.metrics[m.key] ?? []} unit={m.unit} height={140} /></div>)}
          </div>
        </Card>
      )}

      {/* 7. Checkpoints */}
      <Card title="Checkpoints and calibrations">
        {d.calibrations.length === 0 ? <Empty>No calibrations yet.</Empty> : (
          <ul className="text-sm">
            {d.calibrations.map((c) => (
              <li key={c.id}>{formatDate(c.created_at.slice(0, 10))}: <b>{c.decision.replace("_", " ")}</b>{c.observed_lb_per_week != null ? ` · observed ${fmt.signed(Number(c.observed_lb_per_week), 2)} vs planned ${fmt.signed(Number(c.planned_lb_per_week), 2)} lb/wk` : ""}{c.applied_adjustment_kcal ? ` · ${fmt.signed(Number(c.applied_adjustment_kcal), 0)} kcal` : ""}{c.trainer_decision_note ? ` — ${c.trainer_decision_note}` : ""}</li>
            ))}
          </ul>
        )}
        <ul className="mt-2 text-sm text-stone">
          {d.checkpoints.map((c) => <li key={c.id}>{formatDate(c.due_date)} · week {c.week} {c.kind === "review" ? "calibration" : c.kind} {c.completed_at ? "✔" : ""}</li>)}
        </ul>
      </Card>
    </div>
  );
}
