/**
 * Build the Excel export for the two sample clients, recalculate it with
 * LibreOffice (headless), and fail on any formula error or on recalculated
 * numbers that disagree with the app's deterministic calculators.
 *
 *   npm run verify:xlsx
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { generatePlan, libraryDefaultSelector } from "../src/lib/generator";
import { buildPlanWorkbook } from "../src/lib/export/xlsx";
import { DEFAULT_DISCLAIMER } from "../src/config/tasks";
import { EX_LIB, FOOD_LIB, PERF_INTAKE, WL_INTAKE } from "../src/test/fixtures";

const OUT = path.resolve("exports-check");
const ERR = /^(#REF!|#NAME\?|#VALUE!|#DIV\/0!|#N\/A|#NUM!|#NULL!|Err:\d+)/;

async function main() {
  mkdirSync(path.join(OUT, "recalc"), { recursive: true });
  let failures = 0;
  const cases = [
    { name: "weight-loss", goal: "weight_loss" as const, intake: WL_INTAKE, status: "draft" as const },
    { name: "performance", goal: "performance" as const, intake: PERF_INTAKE, status: "approved" as const },
  ];
  for (const c of cases) {
    const plan = await generatePlan({ goal: c.goal, intake: c.intake, referOut: null, referralsHandled: [], clearance: c.name === "weight-loss" ? { status: "received", notes: "Cleared for exercise", exercise_limits: "No max-effort lifts first 4 weeks", hr_ceiling: 150, rpe_ceiling: 8, activities_to_avoid: "Running on concrete" } : null, exercises: EX_LIB, foods: FOOD_LIB }, {}, "2026-10-05", libraryDefaultSelector);
    const buf = await buildPlanWorkbook({ clientName: `Sample ${c.name}`, goal: c.goal, status: c.status, version: 1, parameters: plan.parameters, training: plan.training, nutrition: plan.nutrition, intake: c.intake, foods: FOOD_LIB, disclaimer: DEFAULT_DISCLAIMER, clearanceNotes: plan.training?.clearance_notes ?? null });
    const file = path.join(OUT, `${c.name}.xlsx`);
    writeFileSync(file, buf);
    execFileSync("soffice", ["--headless", "--calc", "--convert-to", "xlsx", "--outdir", path.join(OUT, "recalc"), file], { stdio: "ignore" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(OUT, "recalc", `${c.name}.xlsx`));
    let formulas = 0;
    const errors: string[] = [];
    wb.eachSheet((ws) =>
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          const v = cell.value as ExcelJS.CellFormulaValue | string | null;
          if (v && typeof v === "object" && "formula" in v) {
            formulas++;
            const res = v.result as unknown;
            const s = res && typeof res === "object" && "error" in (res as object) ? String((res as { error: string }).error) : String(res ?? "");
            if (ERR.test(s)) errors.push(`${ws.name}!${cell.address} = ${s} (${v.formula})`);
          } else if (typeof v === "string" && ERR.test(v)) errors.push(`${ws.name}!${cell.address} = ${v}`);
        }),
      ),
    );
    const num = (sheet: string, addr: string) => {
      const v = wb.getWorksheet(sheet)!.getCell(addr).value as ExcelJS.CellFormulaValue;
      // LibreOffice omits the cached value when a formula evaluates to exactly 0.
      if (typeof v === "object" && v && "formula" in v) return Number(v.result ?? 0);
      return Number(v);
    };
    const checks: [string, number, number, number][] = [
      ["TDEE", num("Energy Balance", "B42"), plan.energy!.tdee, 0.6],
      ["BMR", num("Energy Balance", "B34"), plan.energy!.bmr, 0.1],
      ["Planned exercise/day", num("Energy Balance", "B39"), plan.energy!.planned_exercise_kcal_per_day, 0.6],
      ["Target intake", num("Energy Balance", "B40"), plan.energy!.target_kcal, 0.6],
      ["Predicted lb/week", num("Energy Balance", "B44"), plan.energy!.predicted_lb_per_week, 0.01],
      ["Calorie target", num("Nutrition Targets", "B5"), plan.nutrition.targets!.calories, 0],
      ["Carbs", num("Nutrition Targets", "B7"), plan.nutrition.targets!.carbs_g, 0],
      ["4P+4C+9F − target", Math.abs(num("Nutrition Targets", "B11")), 0, 2],
    ];
    const mismatches = checks.filter(([, got, want, tol]) => !(Math.abs(got - want) <= tol));
    console.log(`${c.name}: ${wb.worksheets.length} sheets, ${formulas} formulas, ${errors.length} errors, ${mismatches.length} mismatches`);
    for (const e of errors.slice(0, 20)) console.log("  ERROR", e);
    for (const [label, got, want] of mismatches) console.log(`  MISMATCH ${label}: sheet ${got} vs app ${want}`);
    failures += errors.length + mismatches.length;
  }
  if (failures) process.exit(1);
  console.log("OK — workbooks recalculate cleanly and match the app.");
}
main();
