import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/data/clients";
import { getSettings } from "@/lib/data/settings";
import { calibrationPreview } from "@/lib/data/calibration-data";
import { Badge, Banner, Card, fmt } from "@/components/ui";
import { CalibrationForm } from "@/components/calibration-form";
import { formatDate, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DECISION_TONE = { keep: "green", adjust: "blue", fix_adherence: "yellow", insufficient_data: "gray" } as const;

export default async function CalibratePage({ params, searchParams }: { params: { id: string }; searchParams: { checkpoint?: string } }) {
  const db = createClient();
  const client = await getClient(db, params.id);
  if (!client) notFound();
  const settings = await getSettings(db);
  const pv = await calibrationPreview(db, client.id, searchParams.checkpoint ?? null, settings, todayIn(), null);
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href={`/clients/${client.id}`} className="text-sm">← {client.name}</Link>
        <h1>Calibration{pv?.checkpoint ? ` — week ${pv.checkpoint.week} checkpoint` : " (on demand)"}</h1>
      </div>
      {!pv ? (
        <Banner tone="yellow" title="Needs an approved plan with nutrition targets." />
      ) : (
        <>
          <Card title="Inputs">
            <div className="table-wrap"><table className="table text-sm">
              <tbody>
                <tr><td>Period</td><td>{formatDate(pv.input.periodStart)} → {formatDate(pv.input.periodEnd)} (weeks 1–2 of the plan are excluded)</td></tr>
                <tr><td>Weigh-ins used</td><td>{pv.result.weigh_in_points} across {pv.result.span_days} days (need 3+ across 14+ days)</td></tr>
                <tr><td>Planned rate</td><td>{fmt.signed(pv.input.plannedLbPerWeek, 2)} lb/week (band {fmt.signed(pv.input.plannedBand!.high, 2)} to {fmt.signed(pv.input.plannedBand!.low, 2)})</td></tr>
                <tr><td>Observed rate (slope)</td><td>{pv.result.observed_lb_per_week != null ? `${fmt.signed(pv.result.observed_lb_per_week, 2)} lb/week` : "—"}</td></tr>
                <tr><td>Implied daily balance</td><td>{pv.result.implied_daily_balance != null ? `${fmt.signed(pv.result.implied_daily_balance, 0)} kcal/day (observed × 3,500 ÷ 7, planning approximation)` : "—"}</td></tr>
                <tr><td>Adherence</td><td>{pv.input.adherencePct != null ? `${pv.input.adherencePct.toFixed(0)}% (${pv.adherenceSource.replace(/_/g, " ")})` : "not logged — enter it below"}</td></tr>
                <tr><td>Current target</td><td>{fmt.n(pv.input.currentTargetKcal)} kcal/day</td></tr>
              </tbody>
            </table></div>
            <details className="mt-2 text-sm"><summary className="cursor-pointer">Weigh-ins</summary><ul className="mt-1">{pv.weighIns.map((w) => <li key={w.date}>{formatDate(w.date)}: {w.weight} lb</li>)}</ul></details>
          </Card>
          <Card title="Recommendation">
            <p className="text-sm"><Badge tone={DECISION_TONE[pv.result.decision]}>{pv.result.decision.replace("_", " ")}</Badge> {pv.result.explanation}</p>
            {pv.result.decision === "adjust" && <p className="mt-1 text-sm">Recommended: <b>{fmt.signed(pv.result.recommended_adjustment_kcal, 0)} kcal/day</b> → {fmt.n(pv.result.recommended_target_kcal)} kcal. Macros are recomputed with the same rules and every guardrail is re-checked on save.</p>}
            <p className="mt-1 text-xs text-slate-400">You approve or edit every adjustment. Keep/adjust also refreshes the energy model with the current weight and this week&apos;s program, and after a successful calibration the uncertainty narrows to ±{(settings.uncertainty.calibrated * 100).toFixed(0)}%.</p>
          </Card>
          <Card title="Your decision">
            <CalibrationForm clientId={client.id} checkpointId={pv.checkpoint?.id ?? null} recommended={{ decision: pv.result.decision, adjustment: pv.result.recommended_adjustment_kcal }} adherence={pv.input.adherencePct} />
          </Card>
        </>
      )}
    </div>
  );
}
