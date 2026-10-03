/**
 * Fillable client workout log for one week (exceljs). One row per set; the
 * client types weight and reps into the yellow cells (Excel, Numbers or
 * Google Sheets on a phone). Same input convention as the plan workbook:
 * blue text on yellow.
 */
import ExcelJS from "exceljs";
import { EFFORT_NOTE, type ClientWeek } from "@/lib/client-week";

const FONT = "Arial";
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const DAY_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const THIN: Partial<ExcelJS.Borders> = { top: { style: "thin", color: { argb: "FFCBD5E1" } }, bottom: { style: "thin", color: { argb: "FFCBD5E1" } }, left: { style: "thin", color: { argb: "FFCBD5E1" } }, right: { style: "thin", color: { argb: "FFCBD5E1" } } };

const COLS = [
  { header: "Exercise", width: 34 },
  { header: "Set", width: 6 },
  { header: "Target", width: 14 },
  { header: "Rest", width: 7 },
  { header: "Effort", width: 8 },
  { header: "Weight (lb)", width: 12 },
  { header: "Reps / sec", width: 11 },
  { header: "Notes", width: 30 },
];
const INPUT_COLS = [6, 7, 8];

/** Hidden sheet that maps input rows back to plan sets, for importing. */
export const META_SHEET = "coach_console_meta";
export interface WeekSheetMeta {
  v: 1;
  clientId: string;
  planId: string;
  week: number;
  sets: { row: number; date: string; sessionKey: string; exerciseId: string; set: number; unit: "reps" | "seconds" }[];
}

export async function buildClientWeekWorkbook(w: ClientWeek, ids?: { clientId: string; planId: string }): Promise<Buffer> {
  const metaSets: WeekSheetMeta["sets"] = [];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coach Console";
  const ws = wb.addWorksheet(`Week ${w.week}`, {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = COLS.map((c) => ({ width: c.width }));

  const title = ws.getCell("A1");
  title.value = `${w.clientName}: Week ${w.week} of ${w.totalWeeks}${w.draft ? " (DRAFT)" : ""}`;
  title.font = { name: FONT, size: 14, bold: true };
  const sub = ws.getCell("A2");
  sub.value = `${w.range} · ${w.phase}${w.deload ? " · Deload week: lighter on purpose" : ""} · Fill in the yellow cells (BW for bodyweight) and send it back.`;
  sub.font = { name: FONT, size: 9, color: { argb: "FF475569" } };

  const head = ws.getRow(4);
  COLS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 9, bold: true };
    cell.fill = HEAD_FILL;
    cell.border = THIN;
  });

  let r = 5;
  const input = (row: ExcelJS.Row, cols = INPUT_COLS) => {
    for (const c of cols) {
      const cell = row.getCell(c);
      cell.fill = INPUT_FILL;
      cell.font = { name: FONT, size: 10, color: { argb: "FF1D4ED8" } };
    }
  };
  for (const d of w.days) {
    const parts = [d.strength?.name, d.cardio && "Cardio", d.mobility && "Mobility"].filter(Boolean);
    const bar = ws.getRow(r++);
    bar.getCell(1).value = `${d.label} · ${parts.length ? parts.join(" + ") : "Rest day"}`;
    ws.mergeCells(bar.number, 1, bar.number, COLS.length);
    bar.getCell(1).fill = DAY_FILL;
    bar.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    bar.height = 18;
    for (const o of d.other) {
      const row = ws.getRow(r++);
      row.getCell(1).value = o;
      row.getCell(1).font = { name: FONT, size: 9, italic: true, color: { argb: "FF475569" } };
    }
    for (const e of d.strength?.exercises ?? []) {
      for (let n = 1; n <= e.sets; n++) {
        const row = ws.getRow(r++);
        const vals: (string | number)[] = [n === 1 ? e.name : "", n, e.target, e.rest, e.effort];
        vals.forEach((v, i) => (row.getCell(i + 1).value = v));
        for (let c = 1; c <= COLS.length; c++) {
          row.getCell(c).border = THIN;
          if (!INPUT_COLS.includes(c)) row.getCell(c).font = { name: FONT, size: 10, bold: c === 1 };
        }
        row.getCell(2).alignment = { horizontal: "center" };
        if (n === 2 && e.easier) row.getCell(1).value = `  Easier: ${e.easier}`;
        if (n === 2 && e.easier) row.getCell(1).font = { name: FONT, size: 8, color: { argb: "FF475569" } };
        input(row);
        if (d.strength) metaSets.push({ row: row.number, date: d.date, sessionKey: d.strength.key, exerciseId: e.exerciseId, set: n, unit: e.unit });
      }
    }
    if (d.cardio) {
      const row = ws.getRow(r++);
      row.getCell(1).value = `Cardio: ${d.cardio}`;
      row.getCell(1).font = { name: FONT, size: 9 };
      row.getCell(6).font = { name: FONT, size: 9 };
      row.getCell(1).alignment = { wrapText: true, vertical: "top" };
      row.getCell(6).value = "Minutes →";
      row.getCell(6).alignment = { horizontal: "right" };
      for (let c = 1; c <= COLS.length; c++) row.getCell(c).border = THIN;
      input(row, [7, 8]);
      ws.mergeCells(row.number, 1, row.number, 5);
      row.height = 28;
    }
    if (d.mobility) {
      const row = ws.getRow(r++);
      row.getCell(1).value = `${d.mobility.text}: ${d.mobility.moves.join(", ")}`;
      row.getCell(1).font = { name: FONT, size: 9 };
      row.getCell(6).font = { name: FONT, size: 9 };
      row.getCell(1).alignment = { wrapText: true, vertical: "top" };
      row.getCell(6).value = "Done? →";
      row.getCell(6).alignment = { horizontal: "right" };
      for (let c = 1; c <= COLS.length; c++) row.getCell(c).border = THIN;
      input(row, [7, 8]);
      ws.mergeCells(row.number, 1, row.number, 5);
      row.height = 30;
    }
    r++;
  }
  const note = ws.getCell(r, 1);
  note.value = `${EFFORT_NOTE} Stop any exercise that causes sharp pain and let your coach know.`;
  note.font = { name: FONT, size: 9, color: { argb: "FF475569" } };
  ws.mergeCells(r, 1, r, COLS.length);
  note.alignment = { wrapText: true };
  ws.getRow(r).height = 26;

  if (ids) {
    const meta: WeekSheetMeta = { v: 1, clientId: ids.clientId, planId: ids.planId, week: w.week, sets: metaSets };
    const ms = wb.addWorksheet(META_SHEET, { state: "veryHidden" });
    ms.getCell("A1").value = JSON.stringify(meta);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
