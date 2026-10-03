import { PageHeader } from "@/components/page-header";
import { createClientAction } from "@/app/actions/clients";
import { Card, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { GOAL_CATEGORIES } from "@/config/goal-templates";
import { goalLabel } from "@/lib/labels";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader back={{ href: "/clients", label: "Clients" }} title="New client" display />
      <Card>
        <form action={createClientAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><input className="input" name="name" required /></Field>
          <Field label="Email"><input className="input" name="email" type="email" /></Field>
          <Field label="Phone"><input className="input" name="phone" /></Field>
          <Field label="Goal category">
            <select className="input" name="goal_category" required defaultValue="weight_loss">
              {GOAL_CATEGORIES.map((g) => <option key={g} value={g}>{goalLabel(g)}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" name="status" defaultValue="prospect">
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
            </select>
          </Field>
          <Field label="Purpose (in the client's words)" className="sm:col-span-2"><textarea className="input" name="purpose_text" rows={2} /></Field>
          <Field label="Planned start date"><input className="input" name="start_date" type="date" /></Field>
          <div className="sm:col-span-2"><SubmitButton className="btn-primary">Create and start intake</SubmitButton></div>
        </form>
      </Card>
    </div>
  );
}
