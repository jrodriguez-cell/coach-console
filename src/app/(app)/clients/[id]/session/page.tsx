import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentPlan, getClient } from "@/lib/data/clients";
import { loadExercises } from "@/lib/data/libraries";
import { Card } from "@/components/ui";
import { SessionForm } from "@/components/session-form";
import { daysBetween, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: { id: string } }) {
  const db = createClient();
  const client = await getClient(db, params.id);
  if (!client) notFound();
  const [plan, lib] = await Promise.all([currentPlan(db, client.id), loadExercises(db)]);
  const t = plan?.training;
  const week = plan ? Math.max(1, Math.min(plan.parameters.weeks, Math.floor(daysBetween(plan.parameters.start_date, todayIn()) / 7) + 1)) : 1;
  const wk = t?.weeks[week - 1];
  const sessions = (t?.sessions ?? []).map((s) => ({
    key: s.key,
    name: `${s.name} (week ${week})`,
    exercises: s.slots.filter((sl) => wk?.prescriptions[sl.id] && sl.unit === "reps").map((sl) => ({ id: sl.exercise.id, name: sl.exercise.name, sets: wk!.prescriptions[sl.id].sets })),
  }));
  return (
    <div className="space-y-4">
      <div>
        <Link href={`/clients/${client.id}`} className="text-sm">← {client.name}</Link>
        <h1>Log session — {client.name}</h1>
      </div>
      <Card><SessionForm clientId={client.id} planId={plan?.id ?? null} sessions={sessions} library={lib.map((e) => ({ id: e.id, name: e.name }))} /></Card>
    </div>
  );
}
