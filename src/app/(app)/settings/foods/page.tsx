import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deleteFoodAction, upsertFoodAction } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

const CATS = ["protein", "carb", "fat", "vegetable", "fruit", "dairy", "other"];

export default async function FoodLibrary() {
  const db = createClient();
  const { data } = await db.from("foods").select("*").order("category").order("name");
  const all = data ?? [];
  const row = (f?: (typeof all)[number]) => (
    <form action={upsertFoodAction} className="grid grid-cols-2 gap-1 text-xs md:grid-cols-12">
      <input type="hidden" name="id" value={f?.id ?? ""} />
      <input className="input md:col-span-3" name="name" defaultValue={f?.name} placeholder="Name" required />
      <select className="input" name="category" defaultValue={f?.category ?? "protein"}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      <input className="input" name="per_100g_cal" type="number" step="any" defaultValue={f?.per_100g_cal} placeholder="kcal/100g" required />
      <input className="input" name="per_100g_protein" type="number" step="any" defaultValue={f?.per_100g_protein} placeholder="P" required />
      <input className="input" name="per_100g_carb" type="number" step="any" defaultValue={f?.per_100g_carb} placeholder="C" required />
      <input className="input" name="per_100g_fat" type="number" step="any" defaultValue={f?.per_100g_fat} placeholder="F" required />
      <input className="input" name="household_unit" defaultValue={f?.household_unit} placeholder="unit (e.g. cup)" />
      <input className="input" name="household_g" type="number" step="any" defaultValue={f?.household_g} placeholder="g per unit" />
      <input className="input" name="allergens" defaultValue={f?.allergens?.join(", ")} placeholder="allergens" />
      <span className="flex gap-1"><SubmitButton className="btn-sm">{f ? "Save" : "Add"}</SubmitButton></span>
      <input className="input col-span-full" name="dietary_tags" defaultValue={f?.dietary_tags?.join(", ")} placeholder="dietary tags (vegan, vegetarian, pescatarian, gluten_free, dairy_free)" />
    </form>
  );
  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm">← Settings</Link>
      <PageHeader back={{ href: "/settings", label: "Settings" }} title="Food library" display meta={`${all.length} foods`} />
      <p className="muted">Values per 100 g. Example days are built only from these foods and checked against every tolerance band.</p>
      <Card title="Add food">{row()}</Card>
      <Card>
        <div className="table-wrap"><table className="table table-stack text-xs">
          <thead><tr><th>Food</th><th>Category</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>Household</th><th>Allergens</th><th></th></tr></thead>
          <tbody>
            {all.map((f) => (
              <tr key={f.id}>
                <td data-primary>{f.name}</td><td data-label="Category">{f.category}</td><td data-label="kcal / 100 g">{f.per_100g_cal}</td><td data-label="Protein">{f.per_100g_protein}</td><td data-label="Carbs">{f.per_100g_carb}</td><td data-label="Fat">{f.per_100g_fat}</td><td data-label="Household">{f.household_portion_text}</td><td data-label="Allergens">{f.allergens.join(", ") || "—"}</td>
                <td className="whitespace-nowrap"><details><summary className="cursor-pointer text-bone">Edit</summary>{row(f)}<form action={deleteFoodAction.bind(null, f.id)}><button className="btn btn-sm mt-1">Delete</button></form></details></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}
