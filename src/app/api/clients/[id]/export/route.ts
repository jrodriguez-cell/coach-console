import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything stored for one client, as JSON (data portability). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = createClient();
  const id = params.id;
  const { data: client } = await db.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const byClient = ["intakes", "clearances", "referrals", "plans", "checkpoints", "calibrations", "contact_log", "measurements", "benchmarks", "workout_sessions", "metric_entries", "tasks"] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), client };
  for (const t of byClient) out[t] = (await db.from(t).select("*").eq("client_id", id)).data ?? [];
  const planIds = (out.plans as { id: string }[]).map((p) => p.id);
  const sessionIds = (out.workout_sessions as { id: string }[]).map((s) => s.id);
  const benchmarkIds = (out.benchmarks as { id: string }[]).map((b) => b.id);
  out.guardrail_overrides = planIds.length ? (await db.from("guardrail_overrides").select("*").in("plan_id", planIds)).data : [];
  out.energy_models = planIds.length ? (await db.from("energy_models").select("*").in("plan_id", planIds)).data : [];
  out.set_logs = sessionIds.length ? (await db.from("set_logs").select("*").in("session_id", sessionIds)).data : [];
  out.benchmark_results = benchmarkIds.length ? (await db.from("benchmark_results").select("*").in("benchmark_id", benchmarkIds)).data : [];
  const safe = String(client.name).replace(/[^A-Za-z0-9]+/g, "-");
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${safe}-data.json"`, "Cache-Control": "private, no-store" } });
}
