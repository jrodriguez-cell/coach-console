import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
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
    <div className="max-w-4xl space-y-8">
      <PageHeader back={{ href: `/clients/${client.id}`, label: client.name }} eyebrow="Intake" title={client.name} meta="Saving creates a new intake version; earlier versions are kept." />
      <IntakeForm clientId={client.id} prev={intake?.answers ?? null} parq={intake?.parq_answers ?? null} refer={intake?.refer_out_flags ?? null} />
    </div>
  );
}
