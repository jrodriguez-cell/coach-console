/**
 * Excel export (exceljs). Structure follows the CMR 12-week workbook, with
 * the meal-plan tabs replaced by Energy Balance, Nutrition Targets, Example
 * Days, Food Lists and Grocery Staples. Arial throughout; inputs are blue
 * text on yellow; cumulative targets, status, dates and every derived number
 * are formulas that reference the input cells.
 */
import ExcelJS from "exceljs";
import { GOAL_TEMPLATES } from "@/config/goal-templates";
import { PHASES } from "@/config/training-variables";
import { METS, NEAT_FACTORS, KCAL_PER_LB } from "@/config/energy";
import { MEASUREMENT_SITES } from "@/config/metrics";
import { planCalendar } from "@/lib/calendar";
import { holdSeconds, sessionsForWeek } from "@/lib/training";
import { daysBetween, weekStart } from "@/lib/dates";
import type { IntakeAnswers } from "@/lib/intake";
import type { LibFood, NutritionPlan, PlanParameters, TrainingPlan } from "@/lib/plan-types";
import type { GoalCategory } from "@/config/goal-templates";

export interface ExportInput {
  clientName: string;
  goal: GoalCategory;
  status: "draft" | "approved" | "archived";
  version: number;
  parameters: PlanParameters;
  training: TrainingPlan | null;
  nutrition: NutritionPlan;
  intake: IntakeAnswers;
  foods: LibFood[];
  disclaimer: string;
  clearanceNotes: string | null;
}

const ARIAL = "Arial";
const BLUE = "FF0000FF";
const YELLOW = "FFFFF2CC";
const HEAD_FILL = "FFE2E8F0";

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function input(c: ExcelJS.Cell, value: ExcelJS.CellValue, numFmt?: string) {
  c.value = value;
  c.font = { name: ARIAL, size: 10, color: { argb: BLUE } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  if (numFmt) c.numFmt = numFmt;
}

function formula(c: ExcelJS.Cell, f: string, result?: number | string | Date | null, numFmt?: string) {
  c.value = result === undefined || result === null ? { formula: f } : ({ formula: f, result } as ExcelJS.CellFormulaValue);
  if (numFmt) c.numFmt = numFmt;
}

function header(ws: ExcelJS.Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { name: ARIAL, size: 10, bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
  });
}

function title(ws: ExcelJS.Worksheet, text: string, status: ExportInput["status"]) {
  ws.getCell("A1").value = text;
  ws.getCell("A1").font = { name: ARIAL, size: 14, bold: true };
  const s = ws.getCell("A2");
  s.value = status === "approved" ? "APPROVED" : "DRAFT — not approved by the trainer. Do not share as final.";
  s.font = { name: ARIAL, size: 11, bold: true, color: { argb: status === "approved" ? "FF15803D" : "FFDC2626" } };
  ws.headerFooter.oddHeader = status === "approved" ? `&L&"Arial"Coach Console` : `&C&"Arial,Bold"&14&KFF0000DRAFT — NOT APPROVED`;
  ws.headerFooter.oddFooter = `&L&"Arial"&8Estimates for educational purposes; not medical advice.&R&"Arial"&8Page &P of &N`;
}

function note(ws: ExcelJS.Worksheet, row: number, text: string, cols = 8) {
  ws.mergeCells(row, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.alignment = { wrapText: true, vertical: "top" };
  c.font = { name: ARIAL, size: 9, italic: true, color: { argb: "FF475569" } };
  ws.getRow(row).height = Math.min(120, 14 * Math.ceil(text.length / 110));
}

function arialEverywhere(ws: ExcelJS.Worksheet) {
  ws.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (c) => {
      c.font = { ...(c.font ?? {}), name: ARIAL, size: c.font?.size ?? 10 };
    }),
  );
}

export async function buildPlanWorkbook(x: ExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coach Console";
  wb.created = new Date();
  const p = x.parameters;
  const t = x.nutrition.targets;
  const e = x.nutrition.energy;
  const tpl = GOAL_TEMPLATES[x.goal];
  // Tabs in the workbook's order (formulas reference sheets by name).
  for (const name of ["Overview & Targets", "Calendar", "Training Program", "Training Log", "Mobility Flows", "Progress Tracker", "Measurements & Lifts", "Energy Balance", "Nutrition Targets", "Example Days", "Food Lists", "Grocery Staples"]) wb.addWorksheet(name);

  // ------------------------------------------------------------------ Overview
  const ov = wb.getWorksheet("Overview & Targets")!;
  ov.columns = [{ width: 34 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  title(ov, `${x.clientName} — ${tpl.label} plan (v${x.version})`, x.status);
  const O = { start: "'Overview & Targets'!$B$6", weeks: "'Overview & Targets'!$B$7", startW: "'Overview & Targets'!$B$9", goalW: "'Overview & Targets'!$B$10", rate: "'Overview & Targets'!$B$11" };
  const ovRows: [string, (c: ExcelJS.Cell) => void][] = [
    ["Client", (c) => (c.value = x.clientName)],
    ["Goal category", (c) => (c.value = tpl.label)],
    ["Plan start date", (c) => input(c, toDate(p.start_date), "yyyy-mm-dd")],
    ["Plan length (weeks)", (c) => input(c, p.weeks)],
    ["Plan end date", (c) => formula(c, "B6+B7*7-1", undefined, "yyyy-mm-dd")],
    ["Starting weight (lb)", (c) => input(c, p.start_weight_lb ?? p.weight_lb)],
    ["Goal weight (lb)", (c) => input(c, x.intake.goal_weight_lb ?? null)],
    ["Planned weekly change (lb, estimate)", (c) => formula(c, "'Energy Balance'!B44", e?.predicted_lb_per_week ?? null, "0.00")],
    ["Likely range (lb/week)", (c) => formula(c, `TEXT('Energy Balance'!B46,"0.0")&" to "&TEXT('Energy Balance'!B47,"0.0")`)],
    ["Weeks to goal at planned rate", (c) => formula(c, `IF(OR(B10="",B11=0),"",ROUND((B10-B9)/B11,1))`)],
    ["Daily calorie target", (c) => formula(c, "'Nutrition Targets'!B5", t?.calories ?? null)],
    ["Protein (g)", (c) => formula(c, "'Nutrition Targets'!B6", t?.protein_g ?? null)],
    ["Carbohydrate (g)", (c) => formula(c, "'Nutrition Targets'!B7", t?.carbs_g ?? null)],
    ["Fat (g)", (c) => formula(c, "'Nutrition Targets'!B8", t?.fat_g ?? null)],
    ["Lifting days / week", (c) => (c.value = p.days_per_week)],
    ["Program style", (c) => (c.value = x.training ? `${x.training.split_label}${x.training.split_reasons?.length ? ` — ${x.training.split_reasons.join(" ")}` : ""}` : "Training on hold (refer out)")],
    ["Phases (4-week blocks)", (c) => (c.value = p.phase_sequence.map((ph) => PHASES[ph].label).join(" → "))],
    ["Calibration checkpoints (weeks)", (c) => (c.value = p.checkpoint_weeks.join(", "))],
  ];
  ovRows.forEach(([label, fill], i) => {
    const r = 4 + i;
    ov.getCell(r, 1).value = label;
    ov.getCell(r, 1).font = { name: ARIAL, bold: true };
    fill(ov.getCell(r, 2));
  });
  let r = 4 + ovRows.length + 1;
  if (x.clearanceNotes) {
    ov.getCell(r, 1).value = "PHYSICIAN CLEARANCE NOTES";
    ov.getCell(r, 1).font = { name: ARIAL, bold: true, color: { argb: "FFDC2626" } };
    note(ov, r + 1, x.clearanceNotes);
    r += 3;
  }
  ov.getCell(r, 1).value = "Programming guidelines";
  ov.getCell(r, 1).font = { name: ARIAL, bold: true };
  tpl.guidelines.forEach((g, i) => (ov.getCell(r + 1 + i, 1).value = `${i + 1}. ${g}`));
  r += tpl.guidelines.length + 2;
  if (x.training?.program_summary) {
    note(ov, r, `Summary: ${x.training.program_summary}`);
    r += 1;
  }
  (x.training?.coaching_notes ?? []).forEach((n) => note(ov, r++, `• ${n}`));
  r += 1;
  ov.getCell(r, 1).value = "Legend: blue text on yellow = input cell. Everything else is calculated.";
  note(ov, r + 1, x.disclaimer);

  // ------------------------------------------------------------ Energy Balance
  const eb = wb.getWorksheet("Energy Balance")!;
  eb.columns = [{ width: 42 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }];
  title(eb, "Energy balance (all figures are estimates)", x.status);
  const measured = e?.mode === "measured";
  const ebIn: [number, string, ExcelJS.CellValue, string?][] = [
    [4, "Mode (formula / measured)", measured ? "measured" : "formula"],
    [5, "Sex (male / female)", x.intake.sex],
    [6, "Age (years)", x.intake.age],
    [7, "Height (cm)", Math.round(x.intake.height_in * 2.54 * 10) / 10],
    [8, "Body weight (lb) — update at each checkpoint", p.weight_lb],
    [10, "Resting equation (Mifflin-St Jeor / Katch-McArdle)", p.bmr_method === "katch" && x.intake.body_fat_pct != null ? "Katch-McArdle" : "Mifflin-St Jeor"],
    [11, "Body fat % (Katch-McArdle only)", x.intake.body_fat_pct ?? null],
    [12, `Non-exercise activity factor (${NEAT_FACTORS[p.neat_level].label})`, NEAT_FACTORS[p.neat_level].factor],
    [13, "Thermic effect of food (fraction of intake)", 0.1],
    [14, "Desired daily deficit (kcal; negative = surplus)", p.deficit],
    [15, "Fixed calorie target (blank = use deficit)", p.calorie_mode === "fixed" ? p.target_override : null],
    [16, "TDEE uncertainty (fraction, ~80% band)", e?.uncertainty_pct ?? 0.1],
    [17, "Measured TDEE (wearable; measured mode)", measured ? e?.measured_tdee ?? null : null],
    [18, "Current baseline exercise (kcal/day; measured mode)", measured ? e?.baseline_exercise_kcal_per_day ?? null : null],
  ];
  for (const [row, label, v] of ebIn) {
    eb.getCell(row, 1).value = label;
    input(eb.getCell(row, 2), v);
  }
  eb.getCell(9, 1).value = "Body weight (kg)";
  formula(eb.getCell(9, 2), "B8/2.20462", undefined, "0.00");
  header(eb, 20, ["Planned exercise (net of resting)", "Category", "MET", "Minutes", "Sessions/wk", "Net kcal/session", "Net kcal/week"]);
  const loads: { label: string; cat: string; met: number; min: number; n: number }[] = [];
  if (x.training) {
    const wk = x.training.weeks[Math.min(p.energy_week, x.training.weeks.length) - 1];
    const counts = new Map<string, number>();
    for (const s of sessionsForWeek(x.training, wk.week)) counts.set(s.key, (counts.get(s.key) ?? 0) + 1);
    for (const [key, n] of counts) {
      const s = x.training.sessions.find((q) => q.key === key)!;
      loads.push({ label: `Strength — ${s.name} (week ${wk.week}, ${PHASES[wk.phase].label})`, cat: "strength", met: METS[PHASES[wk.phase].metKey].met, min: wk.session_minutes[key] ?? 0, n });
    }
    const cw = x.training.cardio.weeks[wk.week - 1];
    if (cw && !x.training.cardio.removed) loads.push({ label: `Cardio — ${METS[x.training.cardio.activity].label}`, cat: "cardio", met: x.training.cardio.met, min: cw.minutes, n: cw.sessions });
    if (x.training.mobility.sessions_per_week > 0) loads.push({ label: "Mobility / recovery", cat: "mobility", met: METS.mobility.met, min: x.training.mobility.minutes, n: x.training.mobility.sessions_per_week });
  }
  const L0 = 21;
  const LN = 32; // fixed block so formulas have a stable range
  for (let i = 0; i < LN - L0 + 1; i++) {
    const row = L0 + i;
    const l = loads[i];
    eb.getCell(row, 1).value = l?.label ?? "";
    input(eb.getCell(row, 2), l?.cat ?? null);
    input(eb.getCell(row, 3), l?.met ?? null);
    input(eb.getCell(row, 4), l?.min ?? null);
    input(eb.getCell(row, 5), l?.n ?? null);
    formula(eb.getCell(row, 6), `IF(OR(C${row}="",D${row}=""),0,(C${row}-1)*$B$9*D${row}/60)`, undefined, "0.0");
    formula(eb.getCell(row, 7), `IF(E${row}="",0,F${row}*E${row})`, undefined, "0.0");
  }
  const comp: [number, string, string, number | null | undefined][] = [
    [34, "Resting (BMR)", `IF(B10="Katch-McArdle",370+21.6*B9*(1-B11/100),10*B9+6.25*B7-5*B6+IF(B5="male",5,-161))`, e?.bmr],
    [35, "Daily activity (non-exercise) = BMR × (factor − 1)", "B34*(B12-1)", e?.nonexercise_kcal],
    [36, "Strength training (kcal/week)", `SUMIF(B${L0}:B${LN},"strength",G${L0}:G${LN})`, e?.strength_kcal_per_week],
    [37, "Cardio (kcal/week)", `SUMIF(B${L0}:B${LN},"cardio",G${L0}:G${LN})`, e?.cardio_kcal_per_week],
    [38, "Mobility (kcal/week)", `SUMIF(B${L0}:B${LN},"mobility",G${L0}:G${LN})`, e?.mobility_kcal_per_week],
    [39, "Planned exercise (kcal/day, weekly average)", "(B36+B37+B38)/7", e?.planned_exercise_kcal_per_day],
    [40, "Target intake (kcal/day)", `IF(B15<>"",B15,IF(B4="measured",B17+B39-B18-B14,(B34+B35+B39-B14)/(1-B13)))`, e?.target_kcal],
    [41, "Food effect (TEF; included in measured TDEE)", `IF(B4="measured",0,B13*B40)`, e?.tef_kcal ?? 0],
    [42, "Estimated TDEE (kcal/day)", `IF(B4="measured",B17+B39-B18,B34+B35+B39+B41)`, e?.tdee],
    [43, "Daily balance (target − TDEE)", "B40-B42", e?.daily_balance],
    [44, "Expected weekly change (lb) — 3,500 kcal/lb planning approximation", `B43*7/${KCAL_PER_LB}`, e?.predicted_lb_per_week],
    [45, "Band half-width (lb/week)", `B42*B16*7/${KCAL_PER_LB}`, e ? (e.predicted_high - e.predicted_low) / 2 : null],
    [46, "Likely range: low (lb/week)", "B44-B45", e?.predicted_low],
    [47, "Likely range: high (lb/week)", "B44+B45", e?.predicted_high],
  ];
  for (const [row, label, f, res] of comp) {
    eb.getCell(row, 1).value = label;
    eb.getCell(row, 1).font = { name: ARIAL, bold: row === 42 || row === 44 };
    formula(eb.getCell(row, 2), f, res ?? null, row >= 44 ? "0.00" : "#,##0.0");
  }
  note(eb, 49, "Exercise energy = (MET − 1) × body kg × hours, net of resting so BMR is not double-counted; it scales with body weight, so update B8 at each checkpoint. Post-exercise afterburn is ignored (conservative). In measured mode the wearable TDEE already includes current exercise and the food effect; only the increase from the program over current exercise is added. Predictions are estimates, not guarantees.");
  note(eb, 50, x.disclaimer);

  // --------------------------------------------------------- Nutrition Targets
  const nt = wb.getWorksheet("Nutrition Targets")!;
  nt.columns = [{ width: 30 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }];
  title(nt, "Daily nutrition targets (estimates)", x.status);
  header(nt, 4, ["", "Target", "% of calories", "± Tolerance", "Low", "High"]);
  nt.getCell("A5").value = "Calories (kcal)";
  formula(nt.getCell("B5"), "ROUND('Energy Balance'!B40,0)", t?.calories ?? null);
  formula(nt.getCell("D5"), "ROUND(B5*0.05,0)", t?.tolerance.calories ?? null);
  nt.getCell("A6").value = "Protein (g)";
  input(nt.getCell("B6"), t?.protein_g ?? null);
  formula(nt.getCell("C6"), "IF(B5=0,0,B6*4/B5)", undefined, "0%");
  input(nt.getCell("D6"), t?.tolerance.protein_g ?? 10);
  nt.getCell("A7").value = "Carbohydrate (g) = remainder";
  formula(nt.getCell("B7"), "MAX(0,ROUND((B5-4*B6-9*B8)/4,0))", t?.carbs_g ?? null);
  formula(nt.getCell("C7"), "IF(B5=0,0,B7*4/B5)", undefined, "0%");
  input(nt.getCell("D7"), t?.tolerance.carbs_g ?? 15);
  nt.getCell("A8").value = "Fat (g)";
  input(nt.getCell("B8"), t?.fat_g ?? null);
  formula(nt.getCell("C8"), "IF(B5=0,0,B8*9/B5)", undefined, "0%");
  input(nt.getCell("D8"), t?.tolerance.fat_g ?? 5);
  for (let row = 5; row <= 8; row++) {
    formula(nt.getCell(row, 5), `B${row}-D${row}`);
    formula(nt.getCell(row, 6), `B${row}+D${row}`);
  }
  nt.getCell("A10").value = "Check: 4P + 4C + 9F (kcal)";
  formula(nt.getCell("B10"), "4*B6+4*B7+9*B8");
  nt.getCell("A11").value = "Difference vs. target (kcal)";
  formula(nt.getCell("B11"), "B10-B5");
  nt.getCell("A12").value = "Protein per lb of reference weight";
  input(nt.getCell("C12"), t?.reference_weight_lb ?? p.weight_lb);
  formula(nt.getCell("B12"), "IF(C12=0,0,B6/C12)", undefined, "0.00");
  nt.getCell("A13").value = "Fiber (g/day, 14 g per 1,000 kcal)";
  formula(nt.getCell("B13"), "ROUND(14*B5/1000,0)");
  nt.getCell("A14").value = "Fluids";
  nt.getCell("B14").value = x.nutrition.hydration_text;
  nt.getCell("A15").value = "Meals";
  nt.getCell("B15").value = x.nutrition.meals_guidance;
  nt.getCell("A17").value = "Guardrails (ISSA): protein 0.7–1.0 g/lb and 10–35% of calories; carbohydrate 45–65% (25–40% acceptable for weight loss); fat 20–35% (never below 15%); calories never below 1,200/day.";
  if (x.nutrition.blocked) nt.getCell("A18").value = x.nutrition.blocked_reason ?? "Nutrition not generated.";
  note(nt, 20, x.disclaimer, 6);

  // --------------------------------------------------------------- Example Days
  const ed = wb.getWorksheet("Example Days")!;
  ed.columns = [{ width: 14 }, { width: 34 }, { width: 22 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }];
  title(ed, "Example days — examples, swap freely", x.status);
  r = 4;
  const foodById = new Map(x.foods.map((f) => [f.id, f]));
  for (const d of x.nutrition.example_days) {
    ed.getCell(r, 1).value = d.label;
    ed.getCell(r, 1).font = { name: ARIAL, bold: true };
    r++;
    header(ed, r, ["Meal", "Food", "Household measure", "Grams", "kcal/100g", "P/100g", "C/100g", "F/100g", "kcal", "P (g)", "C (g)", "F (g)"]);
    r++;
    const first = r;
    for (const m of d.meals) {
      for (const it of m.items) {
        const f = foodById.get(it.food_id);
        ed.getCell(r, 1).value = m.name;
        ed.getCell(r, 2).value = it.name;
        ed.getCell(r, 3).value = it.household;
        input(ed.getCell(r, 4), Math.round(it.grams));
        ed.getCell(r, 5).value = f?.per_100g_cal ?? (it.calories / it.grams) * 100;
        ed.getCell(r, 6).value = f?.per_100g_protein ?? (it.protein_g / it.grams) * 100;
        ed.getCell(r, 7).value = f?.per_100g_carb ?? (it.carbs_g / it.grams) * 100;
        ed.getCell(r, 8).value = f?.per_100g_fat ?? (it.fat_g / it.grams) * 100;
        for (let k = 0; k < 4; k++) {
          const col = String.fromCharCode(69 + k); // E..H
          formula(ed.getCell(r, 9 + k), `D${r}/100*${col}${r}`, undefined, "0");
        }
        r++;
      }
    }
    const last = r - 1;
    ed.getCell(r, 2).value = "Day total";
    ed.getCell(r, 2).font = { name: ARIAL, bold: true };
    for (let k = 0; k < 4; k++) {
      const col = String.fromCharCode(73 + k); // I..L
      formula(ed.getCell(r, 9 + k), `SUM(${col}${first}:${col}${last})`, undefined, "0");
    }
    const tr = r + 1;
    ed.getCell(tr, 2).value = "Target (± tolerance)";
    const refs = [["B5", "D5"], ["B6", "D6"], ["B7", "D7"], ["B8", "D8"]];
    refs.forEach(([tv], k) => formula(ed.getCell(tr, 9 + k), `'Nutrition Targets'!${tv}`));
    const cr = r + 2;
    ed.getCell(cr, 2).value = "Within band?";
    refs.forEach(([tv, tol], k) => {
      const col = String.fromCharCode(73 + k);
      formula(ed.getCell(cr, 9 + k), `IF(ABS(${col}${r}-'Nutrition Targets'!${tv})<='Nutrition Targets'!${tol},"in band","OUTSIDE")`);
    });
    r += 4;
  }
  if (!x.nutrition.example_days.length) ed.getCell(r, 1).value = x.nutrition.blocked ? x.nutrition.blocked_reason ?? "" : "No example days.";
  note(ed, r + 1, x.disclaimer, 12);

  // ------------------------------------------------------------- Food Lists
  const fl = wb.getWorksheet("Food Lists")!;
  fl.columns = [{ width: 16 }, { width: 90 }];
  title(fl, "Food lists (allergens and excluded foods removed)", x.status);
  r = 4;
  for (const [cat, foods] of Object.entries(x.nutrition.food_lists)) {
    fl.getCell(r, 1).value = cat;
    fl.getCell(r, 1).font = { name: ARIAL, bold: true };
    fl.getCell(r, 2).value = foods.map((f) => f.name).join(", ");
    fl.getCell(r, 2).alignment = { wrapText: true };
    r++;
  }
  r++;
  fl.getCell(r++, 1).value = "Swaps";
  for (const s of x.nutrition.swaps) {
    fl.getCell(r, 1).value = s.category;
    fl.getCell(r, 2).value = s.options.map((o) => `${o.name}: ${o.household} (~${o.grams} g)`).join("; ");
    fl.getCell(r, 2).alignment = { wrapText: true };
    r++;
  }
  note(fl, r + 1, x.disclaimer, 2);

  // --------------------------------------------------------- Grocery Staples
  const gs = wb.getWorksheet("Grocery Staples")!;
  gs.columns = [{ width: 50 }, { width: 12 }];
  title(gs, "Grocery staples", x.status);
  header(gs, 4, ["Item", "Have it?"]);
  x.nutrition.grocery_staples.forEach((g, i) => {
    gs.getCell(5 + i, 1).value = g;
    input(gs.getCell(5 + i, 2), null);
  });

  // ------------------------------------------------------------------ Calendar
  const cal = wb.getWorksheet("Calendar")!;
  cal.columns = [{ width: 8 }, { width: 14 }, { width: 8 }, { width: 22 }, { width: 90 }];
  title(cal, "Calendar (dates follow the start date on the Overview tab)", x.status);
  header(cal, 4, ["Week", "Date", "Day", "Phase", "Plan"]);
  r = 5;
  for (const w of planCalendar(p, x.training)) {
    w.days.forEach((d, i) => {
      cal.getCell(r, 1).value = w.week;
      formula(cal.getCell(r, 2), `${O.start}+(A${r}-1)*7+${i}`, toDate(d.date), "yyyy-mm-dd");
      formula(cal.getCell(r, 3), `TEXT(B${r},"ddd")`);
      cal.getCell(r, 4).value = w.phase ? `${PHASES[w.phase as keyof typeof PHASES].label}${w.deload ? " (deload)" : ""}` : "";
      cal.getCell(r, 5).value = d.items.join(" · ");
      r++;
    });
  }

  // --------------------------------------------------------- Training Program
  const tp = wb.getWorksheet("Training Program")!;
  tp.columns = [{ width: 18 }, { width: 38 }, { width: 8 }, { width: 12 }, { width: 8 }, { width: 8 }, { width: 34 }, { width: 34 }, { width: 40 }];
  title(tp, "Training program — week by week", x.status);
  r = 4;
  if (x.clearanceNotes) {
    tp.getCell(r, 1).value = "PHYSICIAN CLEARANCE NOTES";
    tp.getCell(r, 1).font = { name: ARIAL, bold: true, color: { argb: "FFDC2626" } };
    note(tp, r + 1, x.clearanceNotes, 9);
    r += 3;
  }
  if (!x.training) tp.getCell(r, 1).value = x.nutrition.training_blocked_reason ?? "Training not generated.";
  for (const w of x.training?.weeks ?? []) {
    tp.getCell(r, 1).value = `Week ${w.week} — ${PHASES[w.phase].label}${w.deload ? " — DELOAD (≈40% fewer sets, stop at RPE 5–6)" : ""}${w.retest ? " — retest at last session" : ""}`;
    tp.getCell(r, 1).font = { name: ARIAL, bold: true };
    r++;
    header(tp, r++, ["Session", "Exercise", "Sets", "Reps / time", "Rest (s)", "RPE", "Regression", "Progression", "Notes"]);
    for (const s of x.training!.sessions) {
      for (const sl of s.slots) {
        const rx = w.prescriptions[sl.id];
        if (!rx) continue;
        tp.getCell(r, 1).value = s.name;
        tp.getCell(r, 2).value = sl.exercise.name;
        tp.getCell(r, 3).value = rx.sets;
        tp.getCell(r, 4).value = sl.unit === "seconds" ? `${holdSeconds(rx)[0]}–${holdSeconds(rx)[1]} s` : `${rx.reps_min}–${rx.reps_max}`;
        tp.getCell(r, 5).value = rx.rest_sec;
        tp.getCell(r, 6).value = `${rx.rpe_min}–${rx.rpe_max}`;
        tp.getCell(r, 7).value = sl.regression?.name ?? "";
        tp.getCell(r, 8).value = sl.progression?.name ?? "";
        tp.getCell(r, 9).value = sl.note;
        r++;
      }
    }
    const cw = x.training!.cardio.weeks[w.week - 1];
    tp.getCell(r++, 2).value = x.training!.cardio.removed ? "Cardio: removed" : `Cardio: ${cw.sessions} × ${cw.minutes} min ${METS[x.training!.cardio.activity].label.toLowerCase()}${x.training!.cardio.hr_bpm ? ` (${x.training!.cardio.hr_bpm.min}–${x.training!.cardio.hr_bpm.max} bpm, RPE ${x.training!.cardio.rpe})` : ""}`;
    tp.getCell(r++, 2).value = `Mobility: ${x.training!.mobility.sessions_per_week} × ${x.training!.mobility.minutes} min (see Mobility Flows)`;
    r++;
  }

  // ------------------------------------------------------------ Training Log
  const tl = wb.getWorksheet("Training Log")!;
  const setCols = 5;
  tl.columns = [{ width: 6 }, { width: 12 }, { width: 16 }, { width: 34 }, { width: 18 }, ...Array.from({ length: setCols * 2 }, () => ({ width: 8 })), { width: 8 }, { width: 24 }];
  title(tl, "Training log — fill in weight × reps for each set", x.status);
  header(tl, 4, ["Week", "Date", "Session", "Exercise", "Prescribed", ...Array.from({ length: setCols }, (_, i) => [`S${i + 1} lb`, `S${i + 1} reps`]).flat(), "RPE", "Notes"]);
  r = 5;
  for (const w of x.training?.weeks ?? []) {
    for (const sch of sessionsForWeek(x.training!, w.week)) {
      const s = x.training!.sessions.find((q) => q.key === sch.key)!;
      const ws = weekStart(p.start_date, w.week);
      const offset = (sch.day - new Date(toDate(ws)).getUTCDay() + 7) % 7;
      const dayOffset = daysBetween(p.start_date, ws) + offset;
      for (const sl of s.slots) {
        const rx = w.prescriptions[sl.id];
        if (!rx) continue;
        tl.getCell(r, 1).value = w.week;
        formula(tl.getCell(r, 2), `${O.start}+${dayOffset}`, undefined, "yyyy-mm-dd");
        tl.getCell(r, 3).value = s.name;
        tl.getCell(r, 4).value = sl.exercise.name;
        tl.getCell(r, 5).value = `${rx.sets} × ${sl.unit === "seconds" ? `${holdSeconds(rx)[0]}–${holdSeconds(rx)[1]} s` : `${rx.reps_min}–${rx.reps_max}`} @RPE ${rx.rpe_min}–${rx.rpe_max}`;
        for (let k = 0; k < setCols * 2 + 2; k++) input(tl.getCell(r, 6 + k), null);
        r++;
      }
    }
  }

  // ----------------------------------------------------------- Mobility Flows
  const mf = wb.getWorksheet("Mobility Flows")!;
  mf.columns = [{ width: 40 }, { width: 50 }];
  title(mf, "Mobility / recovery flow", x.status);
  if (x.training) {
    mf.getCell("A4").value = `${x.training.mobility.sessions_per_week} sessions/week × ${x.training.mobility.minutes} min, on non-lifting days`;
    header(mf, 6, ["Movement", "Guidance"]);
    x.training.mobility.flow.forEach((m, i) => {
      mf.getCell(7 + i, 1).value = m.name;
      mf.getCell(7 + i, 2).value = "Slow and controlled; breathe; stay pain-free.";
    });
  }

  // --------------------------------------------------------- Progress Tracker
  const pt = wb.getWorksheet("Progress Tracker")!;
  pt.columns = [{ width: 7 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 11 }, { width: 13 }, { width: 11 }, { width: 30 }, { width: 13 }, { width: 13 }, { width: 11 }];
  title(pt, "Progress tracker — weekly weigh-ins vs. planned trajectory", x.status);
  pt.getCell("A3").value = "Band half-width (lb/week, from Energy Balance)";
  formula(pt.getCell("F3"), "'Energy Balance'!B45", undefined, "0.00");
  header(pt, 5, ["Week", "Weigh-in date", "Target (lb)", "Low", "High", "Actual (lb)", "Difference", "Status", "Cumulative change", "Adherence %", "Energy 1–10"]);
  for (let w = 0; w <= p.weeks; w++) {
    const row = 6 + w;
    pt.getCell(row, 1).value = w;
    formula(pt.getCell(row, 2), `${O.start}+A${row}*7`, undefined, "yyyy-mm-dd");
    formula(pt.getCell(row, 3), `${O.startW}+${O.rate}*A${row}`, undefined, "0.0");
    formula(pt.getCell(row, 4), `C${row}-$F$3*A${row}`, undefined, "0.0");
    formula(pt.getCell(row, 5), `C${row}+$F$3*A${row}`, undefined, "0.0");
    input(pt.getCell(row, 6), w === 0 ? p.start_weight_lb ?? p.weight_lb : null);
    formula(pt.getCell(row, 7), `IF(F${row}="","",F${row}-C${row})`, undefined, "0.0");
    const tol = `MAX(1,$F$3*A${row})`;
    const behind = `IF(${O.rate}<0,G${row},IF(${O.rate}>0,-G${row},ABS(G${row})))`;
    formula(pt.getCell(row, 8), `IF(F${row}="","",IF(ABS(G${row})<=${tol},"ON TRACK",IF(${behind}>2*${tol},"BEHIND",IF(${behind}>${tol},"SLIGHTLY BEHIND","AHEAD - check strength and energy"))))`);
    formula(pt.getCell(row, 9), `IF(F${row}="","",F${row}-$F$6)`, undefined, "0.0");
    input(pt.getCell(row, 10), null);
    input(pt.getCell(row, 11), null);
  }
  const endRow = 6 + p.weeks;
  r = endRow + 2;
  pt.getCell(r, 1).value = "Checkpoint rules";
  pt.getCell(r, 1).font = { name: ARIAL, bold: true };
  note(pt, r + 1, `Calibrate at weeks ${p.checkpoint_weeks.join(", ")}. Use at least 3 weigh-ins across 14+ days and never weeks 1–2 (water/glycogen). If adherence < 85%: fix adherence, do not change calories. Else if the observed rate is outside the planned band: adjust calories by the gap, capped at ±150 kcal per checkpoint, and re-check every guardrail. Else keep. The trainer approves every adjustment.`, 11);
  pt.getCell(r + 3, 1).value = "Observed rate since week 3 (lb/week, slope)";
  formula(pt.getCell(r + 3, 6), `IFERROR(SLOPE(F9:F${endRow},A9:A${endRow}),"")`, undefined, "0.00");
  pt.getCell(r + 4, 1).value = "Average adherence % (entered)";
  formula(pt.getCell(r + 4, 6), `IFERROR(AVERAGE(J6:J${endRow}),"")`, undefined, "0");
  pt.getCell(r + 5, 1).value = "Suggested decision";
  formula(pt.getCell(r + 5, 6), `IF(OR(F${r + 3}="",COUNT(F9:F${endRow})<3),"insufficient data",IF(AND(F${r + 4}<>"",F${r + 4}<85),"fix adherence",IF(ABS(F${r + 3}-${O.rate})<=$F$3,"keep","adjust")))`);
  pt.getCell(r + 6, 1).value = "Suggested adjustment (kcal/day, capped ±150)";
  formula(pt.getCell(r + 6, 6), `IF(F${r + 5}="adjust",ROUND(MAX(-150,MIN(150,-(F${r + 3}-${O.rate})*${KCAL_PER_LB}/7)),0),0)`);

  // ----------------------------------------------------- Measurements & Lifts
  const ml = wb.getWorksheet("Measurements & Lifts")!;
  ml.columns = [{ width: 13 }, ...MEASUREMENT_SITES.map(() => ({ width: 10 })), { width: 4 }, { width: 13 }, { width: 30 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 10 }];
  title(ml, "Measurements (inches) and lift tests", x.status);
  header(ml, 4, ["Date", ...MEASUREMENT_SITES.map((s) => s[0].toUpperCase() + s.slice(1))]);
  const measureWeeks = Array.from({ length: Math.ceil(p.weeks / 4) + 1 }, (_, i) => Math.min(i * 4, p.weeks));
  measureWeeks.forEach((wk, i) => {
    formula(ml.getCell(5 + i, 1), `${O.start}+${wk * 7}`, undefined, "yyyy-mm-dd");
    MEASUREMENT_SITES.forEach((_, j) => input(ml.getCell(5 + i, 2 + j), null));
  });
  const mEnd = 5 + measureWeeks.length - 1;
  ml.getCell(mEnd + 1, 1).value = "Change";
  MEASUREMENT_SITES.forEach((_, j) => {
    const col = String.fromCharCode(66 + j);
    // last numeric value (INDEX/MATCH on a huge number) minus the first
    formula(ml.getCell(mEnd + 1, 2 + j), `IF(OR(${col}5="",COUNT(${col}5:${col}${mEnd})<2),"",INDEX(${col}5:${col}${mEnd},MATCH(9.99E+307,${col}5:${col}${mEnd}))-${col}5)`, undefined, "0.0");
  });
  const lc = MEASUREMENT_SITES.length + 3; // first lift column
  header(ml, 4, ["Date", ...MEASUREMENT_SITES.map((s) => s[0].toUpperCase() + s.slice(1)), "", "Test date", "Lift", "Weight (lb)", "Reps", "RPE", "e1RM", "5RM"]);
  const mains = Array.from(new Set((x.training?.sessions ?? []).flatMap((s) => s.slots.filter((sl) => sl.role === "main" && sl.unit === "reps").map((sl) => sl.exercise.name))));
  const testWeeks = [0, ...(x.training?.weeks.filter((w) => w.retest).map((w) => w.week) ?? [])];
  let lr = 5;
  for (const wk of testWeeks) {
    for (const lift of mains) {
      formula(ml.getCell(lr, lc), `${O.start}+${Math.max(0, wk * 7 - 1)}`, undefined, "yyyy-mm-dd");
      ml.getCell(lr, lc + 1).value = lift;
      input(ml.getCell(lr, lc + 2), null);
      input(ml.getCell(lr, lc + 3), null);
      input(ml.getCell(lr, lc + 4), null);
      const W = ml.getCell(lr, lc + 2).address.replace(/\d+/, "");
      const R = ml.getCell(lr, lc + 3).address.replace(/\d+/, "");
      const P = ml.getCell(lr, lc + 4).address.replace(/\d+/, "");
      const E = ml.getCell(lr, lc + 5).address.replace(/\d+/, "");
      formula(ml.getCell(lr, lc + 5), `IF(OR(${W}${lr}="",${R}${lr}=""),"",${W}${lr}*(1+(${R}${lr}+IF(${P}${lr}="",0,10-${P}${lr}))/30))`, undefined, "0");
      formula(ml.getCell(lr, lc + 6), `IF(${E}${lr}="","",${E}${lr}/(1+5/30))`, undefined, "0");
      lr++;
    }
  }
  note(ml, Math.max(lr, mEnd + 3) + 1, "e1RM (Epley) = weight × (1 + reps/30), adding reps in reserve (10 − RPE) when RPE is logged. 5RM = e1RM ÷ (1 + 5/30). Flag lifts below 95% of baseline during weight loss.", 16);

  for (const ws of wb.worksheets) {
    arialEverywhere(ws);
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
