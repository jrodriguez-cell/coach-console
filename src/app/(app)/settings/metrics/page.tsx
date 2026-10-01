import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadMetricDefs } from "@/lib/data/progress-data";
import { Badge, Card, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createMetricAction, moveMetricAction, retireMetricAction, updateMetricAction } from "@/app/actions/settings";
import { GOAL_CATEGORIES } from "@/config/goal-templates";
import { goalLabel } from "@/lib/labels";
import { addDays, formatDate, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Which calculations consume each core metric.
const USES: Record<string, { rule?: string; calibration?: boolean }> = {
  weight_lb: { rule: "weigh-in due / missing, off-trajectory review", calibration: true },
  adherence_pct: { rule: "adherence check-in", calibration: true },
  calories: { rule: "adherence (daily)", calibration: true },
  protein_g: { rule: "adherence (daily)", calibration: true },
  energy_1_10: { rule: "energy follow-up" },
  cardio_min: {},
  sleep_hrs: {},
};
const PER_28: Record<string, number> = { daily: 28, weekly: 4, checkpoint: 1, ad_hoc: 0 };

export default async function MetricsSettings() {
  const db = createClient();
  const today = todayIn();
  const since = addDays(today, -27);
  const [defs, { data: recent }, { data: last }, { count: activeClients }, { data: log }] = await Promise.all([
    loadMetricDefs(db),
    db.from("metric_entries").select("metric_id").gte("date", since),
    db.from("metric_entries").select("metric_id, date").order("date", { ascending: false }).limit(2000),
    db.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("metric_definition_log").select("*").order("changed_at", { ascending: false }).limit(30),
  ]);
  const count = (id: string) => (recent ?? []).filter((r) => r.metric_id === id).length;
  const lastUsed = (id: string) => (last ?? []).find((r) => r.metric_id === id)?.date ?? null;
  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm">← Settings</Link>
      <h1>Tracked metrics</h1>
      <p className="muted">Core metrics feed calculations; they can be made optional or hidden but not deleted. Custom metrics get their own chart automatically. Retiring hides a metric from forms but keeps its history. Every change is logged.</p>
      <Card title="Metrics and usage (last 28 days)">
        <table className="table">
          <thead><tr><th></th><th>Metric</th><th>Frequency</th><th>Filled in</th><th>Used by</th><th>Last entry</th><th>Settings</th></tr></thead>
          <tbody>
            {defs.map((m) => {
              const expected = (activeClients ?? 0) * PER_28[m.frequency];
              const n = count(m.id);
              const fill = expected ? Math.round((n / expected) * 100) : null;
              const u = USES[m.key] ?? {};
              return (
                <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                  <td className="whitespace-nowrap">
                    <form action={moveMetricAction.bind(null, m.id, "up")} className="inline"><button className="btn btn-sm">↑</button></form>
                    <form action={moveMetricAction.bind(null, m.id, "down")} className="inline"><button className="btn btn-sm">↓</button></form>
                  </td>
                  <td>{m.label} {m.is_core ? <Badge tone="blue">core</Badge> : <Badge>custom</Badge>} {!m.active && <Badge tone="gray">{m.retired_at ? "retired" : "hidden"}</Badge>}<div className="text-xs text-slate-500">{m.key} · {m.type}{m.unit ? ` · ${m.unit}` : ""}</div></td>
                  <td>{m.frequency}</td>
                  <td>{fill != null ? `${n} entries (${fill}% of expected)` : `${n} entries`}</td>
                  <td className="text-xs">{[m.show_in_charts && "chart", (u.rule || m.used_by_task_rule) && `task rule${u.rule ? `: ${u.rule}` : ""}`, u.calibration && "calibration"].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{formatDate(lastUsed(m.id))}</td>
                  <td>
                    <details>
                      <summary className="cursor-pointer text-xs text-blue-700">Edit</summary>
                      <form action={updateMetricAction.bind(null, m.id)} className="mt-1 space-y-1 text-xs">
                        <input className="input" name="label" defaultValue={m.label} />
                        <input className="input" name="unit" defaultValue={m.unit ?? ""} placeholder="unit" />
                        {!m.is_core && <select className="input" name="type" defaultValue={m.type}>{["number", "scale_1_10", "boolean", "time", "text"].map((t) => <option key={t}>{t}</option>)}</select>}
                        <select className="input" name="frequency" defaultValue={m.frequency}>{["daily", "weekly", "checkpoint", "ad_hoc"].map((t) => <option key={t}>{t}</option>)}</select>
                        <div className="flex flex-wrap gap-2">{["all", ...GOAL_CATEGORIES].map((g) => <label key={g}><input type="checkbox" name="applies_to" value={g} defaultChecked={m.applies_to.includes(g)} /> {g === "all" ? "all" : goalLabel(g as (typeof GOAL_CATEGORIES)[number])}</label>)}</div>
                        <label className="block"><input type="checkbox" name="required" defaultChecked={m.required} /> required</label>
                        <label className="block"><input type="checkbox" name="show_in_charts" defaultChecked={m.show_in_charts} /> show in charts</label>
                        <label className="block"><input type="checkbox" name="active" defaultChecked={m.active} /> active (shown on forms)</label>
                        <SubmitButton className="btn-sm">Save</SubmitButton>
                      </form>
                      {!m.is_core && (
                        <form action={retireMetricAction.bind(null, m.id, Boolean(!m.retired_at))} className="mt-1"><button className="btn btn-sm">{m.retired_at ? "Restore" : "Retire"}</button></form>
                      )}
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Add a custom metric">
        <form action={createMetricAction} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Label"><input className="input" name="label" required /></Field>
          <Field label="Type"><select className="input" name="type">{["number", "scale_1_10", "boolean", "time", "text"].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Unit"><input className="input" name="unit" /></Field>
          <Field label="Frequency"><select className="input" name="frequency" defaultValue="weekly">{["daily", "weekly", "checkpoint", "ad_hoc"].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <div className="col-span-full flex flex-wrap gap-3 text-sm">{GOAL_CATEGORIES.map((g) => <label key={g}><input type="checkbox" name="applies_to" value={g} /> {goalLabel(g)}</label>)}<span className="text-xs text-slate-500">(none checked = all goals)</span></div>
          <label className="text-sm"><input type="checkbox" name="required" /> Required in the weekly round</label>
          <label className="text-sm"><input type="checkbox" name="show_in_charts" defaultChecked /> Show in charts</label>
          <div><SubmitButton className="btn-primary btn-sm">Add metric</SubmitButton></div>
        </form>
      </Card>
      <Card title="Change log">
        <ul className="text-xs">
          {(log ?? []).map((l) => <li key={l.id}>{formatDate(l.changed_at.slice(0, 10))} · {defs.find((d) => d.id === l.metric_id)?.label}: {JSON.stringify(l.change)}</li>)}
        </ul>
      </Card>
    </div>
  );
}
