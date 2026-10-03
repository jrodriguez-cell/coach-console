import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/data/clients";
import { getSettings } from "@/lib/data/settings";
import { loadProgressData, summarize } from "@/lib/data/progress-data";
import { renderProgressPdf } from "@/lib/export/pdf";
import { plannedAt, WEIGHT_STATUS_LABEL } from "@/lib/progress";
import { formatDate, todayIn } from "@/lib/dates";
import { MEASUREMENT_SITES } from "@/config/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Building a long plan can take several seconds on a cold start.
export const maxDuration = 30;

const sgn = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = createClient();
  const client = await getClient(db, params.id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = await getSettings(db);
  const today = todayIn();
  const d = (await loadProgressData(db, [client])).get(client.id)!;
  const s = summarize(d, today, settings.task_thresholds);
  const w = s.weight;
  const buf = await renderProgressPdf({
    clientName: client.name,
    asOf: today,
    weekLabel: s.meta ? `Week ${s.week} of ${s.meta.weeks}` : "No approved plan",
    weight: {
      status: w ? WEIGHT_STATUS_LABEL[w.status] : "—",
      latest: w?.latest ? `${w.latest.value} lb (${formatDate(w.latest.date)})` : "—",
      trend: w?.latestTrend != null ? `${w.latestTrend.toFixed(1)} lb` : "—",
      change: w?.cumulativeChange != null ? `${sgn(w.cumulativeChange)} lb` : "—",
      toGoal: w?.lbsToGoal != null ? `${w.lbsToGoal.toFixed(1)} lb` : "—",
      rate: w?.observedLbPerWeek != null ? `${sgn(w.observedLbPerWeek, 2)} lb/wk` : "—",
      planned: s.meta ? `${sgn(s.meta.plannedLbPerWeek, 2)} lb/wk (estimate)` : "—",
    },
    weighIns: (d.metrics.weight_lb ?? []).map((p) => ({ date: p.date, weight: p.value, planned: s.meta ? plannedAt(s.meta, p.date) : null })),
    adherence: {
      overall: s.adherence14 != null ? `${Math.round(s.adherence14)}%` : "—",
      sessions: `${s.sessions14.completed} / ${s.sessions14.scheduled}`,
      cardio: s.cardio14.actual != null ? `${Math.round(s.cardio14.actual)}${s.cardio14.planned ? ` / ${Math.round(s.cardio14.planned)}` : ""} min` : "—",
    },
    measurements: MEASUREMENT_SITES.flatMap((site) => {
      const pts = d.measurements.filter((m) => m.site === site);
      return pts.length ? [{ site, baseline: pts[0].value.toFixed(1), latest: pts.at(-1)!.value.toFixed(1), change: sgn(pts.at(-1)!.value - pts[0].value) }] : [];
    }),
    lifts: s.lifts.map((l) => ({ name: l.exercise_name, baseline: l.baseline5rm?.toFixed(0) ?? "—", latest: l.latest5rm?.toFixed(0) ?? "—", pct: l.pctOfBaseline != null ? `${l.pctOfBaseline.toFixed(0)}%` : "—", flag: l.flagLow })),
    benchmarks: s.benchmarks.map((b) => ({ name: b.name, baseline: b.baseline?.toString() ?? "—", target: b.target?.toString() ?? "—", current: b.current?.toString() ?? "—", pct: b.pct != null ? `${Math.round(b.pct)}%` : "—", status: b.status.replace("_", " ") })),
    calibrations: d.calibrations.map((c) => `${formatDate(c.created_at.slice(0, 10))}: ${c.decision.replace("_", " ")}${c.applied_adjustment_kcal ? ` (${sgn(Number(c.applied_adjustment_kcal), 0)} kcal/day)` : ""}`),
  });
  const safe = client.name.replace(/[^A-Za-z0-9]+/g, "-");
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safe}-progress-${today}.pdf"`, "Cache-Control": "private, no-store" } });
}
