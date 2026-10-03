import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClient, getPlan } from "@/lib/data/clients";
import { clientWeek, clientWeekText, currentPlanWeek } from "@/lib/client-week";
import { renderClientWeekPdf } from "@/lib/export/pdf";
import { buildClientWeekWorkbook } from "@/lib/export/client-week-xlsx";
import { todayIn } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Building a long plan can take several seconds on a cold start.
export const maxDuration = 30;

/** Client-facing week sheet. ?week=N (default: current plan week) &format=pdf|txt|xlsx */
export async function GET(req: Request, { params }: { params: { planId: string } }) {
  const db = createClient();
  const plan = await getPlan(db, params.planId);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!plan.training) return NextResponse.json({ error: "This plan has no training program." }, { status: 400 });
  const client = await getClient(db, plan.client_id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const week = Number(url.searchParams.get("week")) || currentPlanWeek(plan.parameters, todayIn());
  const w = clientWeek({ clientName: client.name, draft: plan.status !== "approved", parameters: plan.parameters, training: plan.training }, week);
  const safe = client.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `${safe}-week-${w.week}${w.draft ? "-DRAFT" : ""}`;
  if (url.searchParams.get("format") === "txt") {
    return new NextResponse(clientWeekText(w), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
  }
  if (url.searchParams.get("format") === "xlsx") {
    const xbuf = await buildClientWeekWorkbook(w, { clientId: client.id, planId: plan.id });
    return new NextResponse(new Uint8Array(xbuf), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"`, "Cache-Control": "private, no-store" },
    });
  }
  const buf = await renderClientWeekPdf(w);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
