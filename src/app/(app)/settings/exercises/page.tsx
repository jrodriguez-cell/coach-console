import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { upsertExerciseAction } from "@/app/actions/settings";
import { PATTERN_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ExerciseLibrary({ searchParams }: { searchParams: { q?: string } }) {
  const db = createClient();
  const { data } = await db.from("exercises").select("*").order("pattern").order("name");
  const all = data ?? [];
  const q = (searchParams.q ?? "").toLowerCase();
  const list = q ? all.filter((e) => e.name.toLowerCase().includes(q) || e.pattern.includes(q)) : all;
  const name = (id: string | null) => all.find((e) => e.id === id)?.name ?? "—";
  const row = (e?: (typeof all)[number]) => (
    <form action={upsertExerciseAction} className="grid grid-cols-2 gap-1 text-xs md:grid-cols-9">
      <input type="hidden" name="id" value={e?.id ?? ""} />
      <input className="input md:col-span-2" name="name" defaultValue={e?.name} placeholder="Name" required />
      <select className="input" name="pattern" defaultValue={e?.pattern ?? "squat"}>{Object.entries(PATTERN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input className="input" name="equipment" defaultValue={e?.equipment?.join(", ")} placeholder="equipment" />
      <input className="input" name="contraindications" defaultValue={e?.contraindications?.join(", ")} placeholder="contraindications" />
      <input className="input" name="primary_muscles" defaultValue={e?.primary_muscles?.join(", ")} placeholder="muscles" />
      <select className="input" name="regression_id" defaultValue={e?.regression_id ?? ""}><option value="">regression —</option>{all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select className="input" name="progression_id" defaultValue={e?.progression_id ?? ""}><option value="">progression —</option>{all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <span className="flex items-center gap-1"><label><input type="checkbox" name="is_compound" defaultChecked={e?.is_compound} /> compound</label><SubmitButton className="btn-sm">{e ? "Save" : "Add"}</SubmitButton></span>
      <input className="input col-span-full" name="video_url" defaultValue={e?.video_url ?? ""} placeholder="video URL (optional)" />
    </form>
  );
  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm">← Settings</Link>
      <h1>Exercise library ({all.length})</h1>
      <form className="flex gap-2"><input className="input max-w-xs" name="q" defaultValue={searchParams.q} placeholder="Search" /><button className="btn">Search</button></form>
      <Card title="Add exercise">{row()}</Card>
      <Card>
        <div className="table-wrap"><table className="table text-xs">
          <thead><tr><th>Exercise</th><th>Pattern</th><th>Equipment</th><th>Contraindications</th><th>Regression → progression</th><th></th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{e.name}{e.is_compound ? " ·C" : ""}</td><td>{PATTERN_LABEL[e.pattern] ?? e.pattern}</td><td>{e.equipment.join(", ")}</td><td>{e.contraindications.join(", ") || "—"}</td><td>{name(e.regression_id)} → {name(e.progression_id)}</td>
                <td><details><summary className="cursor-pointer text-bone">Edit</summary>{row(e)}</details></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}
