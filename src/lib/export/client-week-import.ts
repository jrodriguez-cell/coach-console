/**
 * Read a filled-in week sheet (from buildClientWeekWorkbook) back into
 * sessions and sets, using the hidden row map. Pure: no database access.
 */
import ExcelJS from "exceljs";
import { META_SHEET, type WeekSheetMeta } from "./client-week-xlsx";

export interface ImportedSet { exerciseId: string; set: number; weightLb: number | null; reps: number | null; note: string | null }
export interface ImportedSession { date: string; sessionKey: string; sets: ImportedSet[] }
export interface WeekSheetImport { meta: WeekSheetMeta; sessions: ImportedSession[]; skippedCells: string[] }

const BODYWEIGHT = /^(bw|body ?weight|-|—|none)$/i;

function cellNumber(v: ExcelJS.CellValue): number | null | "bw" | "bad" {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : "bad";
  if (typeof v === "object" && "result" in (v as object)) return cellNumber((v as { result: ExcelJS.CellValue }).result);
  const s = String(typeof v === "object" && "richText" in (v as object) ? (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("") : v).trim();
  if (!s) return null;
  if (BODYWEIGHT.test(s)) return "bw";
  const n = Number(s.replace(/[^\d.]/g, ""));
  return s.match(/\d/) && Number.isFinite(n) ? n : "bad";
}

export async function readWeekSheet(data: ArrayBuffer | Buffer): Promise<WeekSheetImport> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  const ms = wb.getWorksheet(META_SHEET);
  if (!ms) throw new Error("This isn't a Coach Console week sheet (it has no plan map). Use the Excel downloaded from the plan's Send week card.");
  let meta: WeekSheetMeta;
  try {
    meta = JSON.parse(String(ms.getCell("A1").value));
  } catch {
    throw new Error("The sheet's plan map is damaged.");
  }
  const ws = wb.worksheets.find((s) => s.name !== META_SHEET);
  if (!ws) throw new Error("The sheet has no workout page.");
  const byKey = new Map<string, ImportedSession>();
  const skippedCells: string[] = [];
  for (const m of meta.sets) {
    const row = ws.getRow(m.row);
    const w = cellNumber(row.getCell(6).value);
    const r = cellNumber(row.getCell(7).value);
    const noteRaw = row.getCell(8).value;
    const note = noteRaw == null || String(noteRaw).trim() === "" ? null : String(noteRaw).trim();
    if (w === "bad") skippedCells.push(`F${m.row}`);
    if (r === "bad" || r === "bw") skippedCells.push(`G${m.row}`);
    const weightLb = typeof w === "number" ? w : null;
    const reps = typeof r === "number" ? Math.round(r) : null;
    if (weightLb == null && reps == null && w !== "bw") continue; // nothing logged for this set
    const k = `${m.date}|${m.sessionKey}`;
    if (!byKey.has(k)) byKey.set(k, { date: m.date, sessionKey: m.sessionKey, sets: [] });
    byKey.get(k)!.sets.push({ exerciseId: m.exerciseId, set: m.set, weightLb, reps, note });
  }
  return { meta, sessions: [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date)), skippedCells };
}
