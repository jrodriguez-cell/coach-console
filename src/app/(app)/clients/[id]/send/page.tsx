import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentPlan } from "@/lib/data/clients";
import { currentPlanWeek } from "@/lib/client-week";
import { todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Shortcut from a "Send week N plan" task to that week's share screen. */
export default async function SendWeekPage({ params, searchParams }: { params: { id: string }; searchParams: { date?: string } }) {
  const db = createClient();
  const plan = await currentPlan(db, params.id);
  if (!plan) notFound();
  const week = currentPlanWeek(plan.parameters, searchParams.date ?? todayIn());
  redirect(`/clients/${params.id}/plan/${plan.id}?tab=training&week=${week}#send`);
}
