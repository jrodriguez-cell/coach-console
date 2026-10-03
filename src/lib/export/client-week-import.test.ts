import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generatePlan, libraryDefaultSelector } from "@/lib/generator";
import { clientWeek } from "@/lib/client-week";
import { buildClientWeekWorkbook, META_SHEET } from "./client-week-xlsx";
import { readWeekSheet } from "./client-week-import";
import { EX_LIB, FOOD_LIB, PERF_INTAKE } from "@/test/fixtures";

async function sheet() {
  const p = await generatePlan({ goal: "performance", intake: PERF_INTAKE, referOut: null, referralsHandled: [], clearance: null, exercises: EX_LIB, foods: FOOD_LIB }, {}, "2026-10-05", libraryDefaultSelector);
  const w = clientWeek({ clientName: "Sam", draft: false, parameters: p.parameters, training: p.training! }, 2);
  return { w, buf: await buildClientWeekWorkbook(w, { clientId: "c1", planId: "p1" }) };
}

describe("week sheet round trip", () => {
  it("reads filled sets back by plan row, grouped per session", async () => {
    const { w, buf } = await sheet();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const meta = JSON.parse(String(wb.getWorksheet(META_SHEET)!.getCell("A1").value));
    const ws = wb.worksheets[0];
    const [a, b, c] = meta.sets;
    ws.getRow(a.row).getCell(6).value = 135; ws.getRow(a.row).getCell(7).value = 8;
    ws.getRow(b.row).getCell(6).value = "135 lb"; ws.getRow(b.row).getCell(7).value = "7"; ws.getRow(b.row).getCell(8).value = "felt heavy";
    ws.getRow(c.row).getCell(6).value = "BW"; ws.getRow(c.row).getCell(7).value = 12;
    const filled = await wb.xlsx.writeBuffer();

    const out = await readWeekSheet(filled as ArrayBuffer);
    expect(out.meta).toMatchObject({ clientId: "c1", planId: "p1", week: 2 });
    const firstDay = w.days.find((d) => d.strength)!;
    expect(out.sessions[0]).toMatchObject({ date: firstDay.date, sessionKey: firstDay.strength!.key });
    const sets = out.sessions.flatMap((s) => s.sets);
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ weightLb: 135, reps: 8, note: null });
    expect(sets[1]).toMatchObject({ weightLb: 135, reps: 7, note: "felt heavy" });
    expect(sets[2]).toMatchObject({ weightLb: null, reps: 12 });
  });

  it("rejects a workbook without the plan map", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1");
    await expect(readWeekSheet((await wb.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow(/isn't a Coach Console week sheet/);
  });
});
