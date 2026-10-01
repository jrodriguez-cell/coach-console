/**
 * Render the plan PDF (draft, with clearance notes) and the progress-report
 * PDF for the sample clients.  npm run verify:pdf
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { generatePlan, libraryDefaultSelector } from "@/lib/generator";
import { renderPlanPdf, renderProgressPdf } from "@/lib/export/pdf";
import { DEFAULT_DISCLAIMER } from "@/config/tasks";
import { EX_LIB, FOOD_LIB, PERF_INTAKE, WL_INTAKE } from "@/test/fixtures";

(async () => {
  mkdirSync("exports-check", { recursive: true });
  for (const c of [
    { name: "weight-loss", goal: "weight_loss" as const, intake: WL_INTAKE, status: "draft" as const },
    { name: "performance", goal: "performance" as const, intake: PERF_INTAKE, status: "approved" as const },
  ]) {
    const clearance = c.name === "weight-loss" ? { status: "received" as const, notes: "Cleared for exercise", exercise_limits: "No max-effort lifts first 4 weeks", hr_ceiling: 150, rpe_ceiling: 8, activities_to_avoid: "Running on concrete" } : null;
    const plan = await generatePlan({ goal: c.goal, intake: c.intake, referOut: null, referralsHandled: [], clearance, exercises: EX_LIB, foods: FOOD_LIB }, {}, "2026-10-05", libraryDefaultSelector);
    const buf = await renderPlanPdf({ clientName: `Sample ${c.name}`, goal: c.goal, status: c.status, version: 1, parameters: plan.parameters, training: plan.training, nutrition: plan.nutrition, intake: c.intake, foods: FOOD_LIB, disclaimer: DEFAULT_DISCLAIMER, clearanceNotes: plan.training?.clearance_notes ?? null });
    writeFileSync(`exports-check/${c.name}.pdf`, buf);
    console.log(`${c.name}.pdf`, buf.length, "bytes");
  }
  const rep = await renderProgressPdf({
    clientName: "Sample weight-loss", asOf: "2026-11-02", weekLabel: "Week 5 of 12",
    weight: { status: "On track", latest: "265.0 lb", trend: "265.4 lb", change: "−5.0 lb", toGoal: "35.0 lb", rate: "−1.1 lb/wk", planned: "−1.0 lb/wk" },
    weighIns: [{ date: "2026-10-05", weight: 270, planned: 270 }, { date: "2026-11-01", weight: 265, planned: 266 }],
    adherence: { overall: "88%", sessions: "7 / 8", cardio: "240 / 270 min" },
    measurements: [{ site: "waist", baseline: "44.0", latest: "42.5", change: "−1.5" }],
    lifts: [{ name: "Goblet Squat", baseline: "60", latest: "65", pct: "108%", flag: false }],
    benchmarks: [{ name: "Body weight", baseline: "270", target: "230", current: "265", pct: "13%", status: "on track" }],
    calibrations: ["Week 3: keep — observed −1.1 vs planned −1.0 lb/wk"],
  });
  writeFileSync("exports-check/progress-report.pdf", rep);
  console.log("progress-report.pdf", rep.length, "bytes");
})();
