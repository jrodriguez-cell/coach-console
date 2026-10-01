import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClient, latestIntake } from "@/lib/data/clients";
import { IntakeForm } from "@/components/intake-form";

export const dynamic = "force-dynamic";

export default async function IntakePage({ params }: { params: { id: string } }) {
  const db = createClient();
  const client = await getClient(db, params.id);
  if (!client) notFound();
  const intake = await latestIntake(db, params.id);
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href={`/clients/${client.id}`} className="text-sm">← {client.name}</Link>
        <h1>Intake — {client.name}</h1>
        <p className="muted">Saving creates a new intake version; earlier versions are kept.</p>
      </div>
      <IntakeForm clientId={client.id} prev={intake?.answers ?? null} parq={intake?.parq_answers ?? null} refer={intake?.refer_out_flags ?? null} />
    </div>
  );
}
