import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportInput } from "@/lib/data/export-input";
import { buildPlanWorkbook } from "@/lib/export/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Building a long plan can take several seconds on a cold start.
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: { planId: string } }) {
  const db = createClient();
  const x = await exportInput(db, params.planId);
  if (!x) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await buildPlanWorkbook(x.input);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${x.filename}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
