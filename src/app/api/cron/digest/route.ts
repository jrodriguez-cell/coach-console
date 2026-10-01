import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/data/settings";
import { runTaskEngine } from "@/lib/data/task-runner";
import { loadProgressData } from "@/lib/data/progress-data";
import { digestHtml, digestSubject } from "@/lib/digest";
import { dayOfWeek, hourIn, todayIn } from "@/lib/dates";
import { activeReferOutFlags, blockedSections } from "@/lib/intake";
import type { ClientRow, TaskRow } from "@/lib/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron → GET /api/cron/digest?kind=weekly|daily
 * Protected by CRON_SECRET (Authorization: Bearer <secret>). Scheduled at
 * 11:00 UTC (7 AM Eastern in summer, 6 AM in winter); sends on the trainer's Monday.
 * Pass &force=1 (with the secret) to send immediately for testing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "daily" ? "daily" : "weekly";
  const force = url.searchParams.get("force") === "1";
  const today = todayIn();
  const db = createAdminClient();
  const settings = await getSettings(db);
  if (!force) {
    if (kind === "weekly" && dayOfWeek(today) !== 1) return NextResponse.json({ skipped: "not Monday" });
    if (kind === "daily" && !settings.task_thresholds.dailyDigest) return NextResponse.json({ skipped: "daily digest off" });
  }
  const { keyDates, summaries, clients } = await runTaskEngine(db, settings, today, hourIn());
  const names = new Map((clients as ClientRow[]).map((c) => [c.id, c.name]));
  const { data: overdue } = await db.from("tasks").select("*").eq("status", "open").lt("due_date", today).order("due_date");
  const active = (clients as ClientRow[]).filter((c) => c.status === "active");
  const pd = await loadProgressData(db, active);
  const { data: refs } = await db.from("referrals").select("client_id, flag, handled_note");
  const flagged = active
    .map((c) => {
      const d = pd.get(c.id)!;
      const s = summaries.get(c.id);
      const f: string[] = [];
      if (d.intake?.parq_flagged && d.clearance?.status === "pending") f.push("physician clearance pending");
      const blocked = blockedSections(d.intake?.refer_out_flags, (refs ?? []).filter((r) => r.client_id === c.id));
      if (blocked.nutrition.length || blocked.training.length) f.push("refer-out not yet handled");
      else if (activeReferOutFlags(d.intake?.refer_out_flags).length) f.push("refer-out on file");
      if (s?.weight?.status === "behind") f.push("behind planned trajectory");
      if (s?.strengthFlag) f.push("strength below baseline");
      if (s?.adherence14 != null && s.adherence14 < settings.task_thresholds.adherenceLowPct) f.push(`adherence ${Math.round(s.adherence14)}%`);
      return { client: c.name, clientId: c.id, flags: f };
    })
    .filter((x) => x.flags.length);
  const input = {
    kind: kind as "weekly" | "daily",
    today,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    keyDates: kind === "weekly" ? keyDates : keyDates.filter((k) => k.date === today),
    overdue: ((overdue ?? []) as TaskRow[]).map((t) => ({ client: t.client_id ? names.get(t.client_id) ?? "Client" : "General", title: t.title, due: t.due_date })),
    flagged,
  };
  if (!process.env.RESEND_API_KEY || !process.env.TRAINER_EMAIL) return NextResponse.json({ error: "RESEND_API_KEY / TRAINER_EMAIL not set" }, { status: 500 });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.DIGEST_FROM || "Coach Console <onboarding@resend.dev>",
    to: process.env.TRAINER_EMAIL,
    subject: digestSubject(input),
    html: digestHtml(input),
  });
  if (error) return NextResponse.json({ error: "Email send failed" }, { status: 502 });
  // No PII in logs or responses.
  return NextResponse.json({ sent: true, kind, keyDates: input.keyDates.length, overdue: input.overdue.length, flagged: flagged.length });
}
