/**
 * Printable plan, progress-report and client-week PDFs (@react-pdf/renderer,
 * server-side), in the Make Time To Move "Ink & Bone" document theme: Ink on
 * Bone, Stone for secondary text, hairline rules; MTTM Lettering for display,
 * Manrope for body; single-line logo in the header, monogram in the footer.
 * DRAFT watermark and header on every page until the plan is approved; the
 * nutrition disclaimer and any clearance notes are always included.
 */
import React from "react";
import path from "node:path";
import { Document, Font, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { GOAL_TEMPLATES } from "@/config/goal-templates";
import { PHASES } from "@/config/training-variables";
import { METS } from "@/config/energy";
import { planCalendar } from "@/lib/calendar";
import { holdSeconds } from "@/lib/training";
import { DAY_NAMES, formatDate } from "@/lib/dates";
import { describePrediction } from "@/lib/energy";
import type { ExportInput } from "./xlsx";
import { EFFORT_NOTE, maxSets, type ClientWeek, type ClientWeekExercise } from "@/lib/client-week";
import { MONOGRAM, type LogoMark } from "@/lib/brand/logo";

const FONT_DIR = path.join(process.cwd(), "src/lib/export/fonts");
Font.register({
  family: "Manrope",
  fonts: [
    { src: path.join(FONT_DIR, "manrope-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "manrope-latin-600-normal.woff"), fontWeight: 600 },
  ],
});
Font.register({
  family: "MTTM Lettering",
  fonts: [
    { src: path.join(FONT_DIR, "mttm-lettering-regular.woff2"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "mttm-lettering-heavy.woff2"), fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

// Sage (Mobility) theme, matching the app: Ink on Sage, Fern for secondary text.
export const INK = "#0E0E0D";
export const SAGE = "#B7C0AE";
export const FERN = "#4F5549"; // Fern deepened for small-text contrast, as in the app
const RULE = "#9EA596"; // Ink at 15% on Sage
const RULE_STRONG = "#848A7E"; // Ink at 30% on Sage

// Map characters missing from Manrope's latin set.
export function pdfText(s: string): string {
  return s
    .replace(/→/g, "->")
    .replace(/↑/g, "^")
    .replace(/↓/g, "v")
    .replace(/≈/g, "~")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[✓✔]/g, "OK")
    .replace(/✕/g, "x");
}

/** MTTM Lettering: capitals and its own character set only. */
export function displayText(s: string): string {
  return pdfText(s)
    .toUpperCase()
    .replace(/×/g, "X")
    .replace(/[−]/g, "-")
    .replace(/…/g, "...")
    .replace(/%/g, " PCT")
    .replace(/[^A-Z0-9 .,:!?'"\-–—/·@+#()&]/g, "");
}

const DISPLAY = { fontFamily: "MTTM Lettering", fontWeight: 400 } as const;
const CAPS = { fontFamily: "Manrope", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.9 } as const;
const BOLD = { fontFamily: "Manrope", fontWeight: 600 } as const;

const s = StyleSheet.create({
  page: { padding: 40, paddingTop: 64, paddingBottom: 56, fontSize: 9, lineHeight: 1.45, fontFamily: "Manrope", color: INK, backgroundColor: SAGE },
  header: { position: "absolute", top: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 0.75, borderBottomColor: INK },
  headerText: { ...CAPS, fontSize: 6.5, color: FERN, maxWidth: "60%", textAlign: "right" },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, fontSize: 7, color: FERN, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  watermark: { position: "absolute", top: 340, left: 70, ...DISPLAY, fontSize: 96, color: INK, opacity: 0.05, transform: "rotate(-35deg)" },
  h1: { ...DISPLAY, fontSize: 13, marginBottom: 8, lineHeight: 1.35 },
  h2: { ...DISPLAY, fontSize: 9, marginTop: 16, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: RULE_STRONG },
  h3: { ...DISPLAY, fontSize: 8, marginTop: 8, marginBottom: 4 },
  muted: { color: FERN },
  box: { borderWidth: 0.5, borderColor: RULE_STRONG, padding: 8, marginVertical: 5 },
  alert: { backgroundColor: INK, color: SAGE, padding: 8, marginVertical: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 3 },
  th: { ...CAPS, fontSize: 6.5, color: FERN, borderBottomColor: INK, borderBottomWidth: 0.75, paddingVertical: 4 },
  disclaimer: { fontSize: 7.5, color: FERN, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: RULE_STRONG, paddingVertical: 6, marginVertical: 8 },
});

/** Logo artwork as vector, filled with the lettering colour. */
function LogoPdf({ mark, width, color = INK }: { mark: LogoMark; width: number; color?: string }) {
  return (
    <Svg viewBox={`0 0 ${mark.width} ${mark.height}`} style={{ width, height: (width * mark.height) / mark.width }}>
      <Path d={mark.d} fill={color} />
    </Svg>
  );
}

/** Display heading in MTTM Lettering (capitals, its own character set). */
const H = ({ children, style, minPresenceAhead }: { children: string; style?: object; minPresenceAhead?: number }) => <Text style={style as never} minPresenceAhead={minPresenceAhead}>{displayText(children)}</Text>;

const T = ({ children, style }: { children: React.ReactNode; style?: object }) => <Text style={style as never}>{typeof children === "string" ? pdfText(children) : children}</Text>;

function Table({ cols, rows, widths }: { cols: string[]; rows: (string | number)[][]; widths: number[] }) {
  return (
    <View style={{ marginTop: 4 }}>
      <View style={[s.row, s.th]} wrap={false}>
        {cols.map((c, i) => <Text key={i} style={{ width: `${widths[i]}%`, paddingRight: 3 }}>{pdfText(c)}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.map((c, j) => <Text key={j} style={{ width: `${widths[j]}%`, paddingRight: 3 }}>{pdfText(String(c))}</Text>)}
        </View>
      ))}
    </View>
  );
}

function Chrome({ x }: { x: Pick<ExportInput, "clientName" | "status"> & { version?: number } }) {
  const draft = x.status !== "approved";
  return (
    <>
      <View style={s.header} fixed>
        <LogoPdf mark={MONOGRAM} width={22} />
        <Text style={s.headerText}>{pdfText(x.version ? `${x.clientName} · v${x.version}` : x.clientName)}{draft ? <Text style={{ color: INK }}>{"   DRAFT"}</Text> : null}</Text>
      </View>
      {draft && <Text style={s.watermark} fixed>DRAFT</Text>}
      <View style={s.footer} fixed>
        <Text>Estimates for educational purposes; not medical advice.</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

export function PlanDocument({ x }: { x: ExportInput }) {
  const p = x.parameters;
  const tpl = GOAL_TEMPLATES[x.goal];
  const t = x.nutrition.targets;
  const e = x.nutrition.energy;
  const tr = x.training;
  const cal = planCalendar(p, tr);
  return (
    <Document title={`${x.clientName} plan v${x.version}`} author="Coach Console">
      <Page size="LETTER" style={s.page}>
        <Chrome x={x} />
        <H style={s.h1}>{`${x.clientName}: ${tpl.label} plan`}</H>
        <T style={s.muted}>{`${formatDate(p.start_date)} · ${p.weeks} weeks · ${p.days_per_week} lifting days/week · ${p.phase_sequence.map((ph) => PHASES[ph].label).join(" -> ")}`}</T>
        {x.clearanceNotes && (
          <View style={s.alert}>
            <T style={BOLD}>Physician clearance notes</T>
            <T>{x.clearanceNotes}</T>
          </View>
        )}
        <H style={s.h2}>Programming guidelines</H>
        {tpl.guidelines.map((g, i) => <T key={i}>{`${i + 1}. ${g}`}</T>)}
        {tr?.program_summary ? <T style={{ marginTop: 4 }}>{tr.program_summary}</T> : null}
        {(tr?.coaching_notes ?? []).map((n, i) => <T key={i}>{`• ${n}`}</T>)}
        {t && (
          <View style={s.box}>
            <T style={BOLD}>Daily targets (estimates)</T>
            <T>{`Calories ${t.calories} kcal (±${t.tolerance.calories}) · Protein ${t.protein_g} g (±${t.tolerance.protein_g}) · Carbohydrate ${t.carbs_g} g (±${t.tolerance.carbs_g}) · Fat ${t.fat_g} g (±${t.tolerance.fat_g})`}</T>
            {e && <T>{`Expected change: ${describePrediction(e)}. Uses 3,500 kcal/lb as a planning approximation; recalibrated from weigh-ins.`}</T>}
          </View>
        )}

        <H style={s.h2}>Training — week by week</H>
        {!tr && <T>{x.nutrition.training_blocked_reason ?? "Training not generated."}</T>}
        {tr && <T style={BOLD}>{`Program: ${tr.split_label}${tr.block_rotations ? " · accessory exercises change each 4-week block" : ""}`}</T>}
        {(tr?.split_reasons ?? []).map((r, i) => <T key={i} style={s.muted}>{`• ${r}`}</T>)}
        {tr?.weeks.map((w) => (
          <View key={w.week} style={{ marginBottom: 6 }}>
            <H style={s.h3} minPresenceAhead={80}>{`Week ${w.week} — ${PHASES[w.phase].label}${w.deload ? " — DELOAD (~40% fewer sets, stop at RPE 5-6)" : ""}${w.retest ? " — retest at last session" : ""}`}</H>
            <Table
              cols={["Session", "Exercise", "Sets x reps", "Rest", "RPE", "Regression / progression"]}
              widths={[14, 30, 12, 7, 7, 30]}
              rows={tr.sessions.flatMap((ss) =>
                ss.slots.filter((sl) => w.prescriptions[sl.id]).map((sl) => {
                  const rx = w.prescriptions[sl.id];
                  const reps = sl.unit === "seconds" ? `${holdSeconds(rx)[0]}-${holdSeconds(rx)[1]} s` : `${rx.reps_min}-${rx.reps_max}`;
                  return [ss.name, sl.exercise.name, `${rx.sets} x ${reps}`, `${rx.rest_sec}s`, `${rx.rpe_min}-${rx.rpe_max}`, `${sl.regression?.name ?? "-"} / ${sl.progression?.name ?? "-"}`];
                }),
              )}
            />
            <T style={s.muted}>{tr.cardio.removed ? "Cardio: removed" : `Cardio: ${tr.cardio.weeks[w.week - 1].sessions} x ${tr.cardio.weeks[w.week - 1].minutes} min ${METS[tr.cardio.activity].label.toLowerCase()}${tr.cardio.hr_bpm ? ` (${tr.cardio.hr_bpm.min}-${tr.cardio.hr_bpm.max} bpm, RPE ${tr.cardio.rpe})` : ""} · Mobility ${tr.mobility.sessions_per_week} x ${tr.mobility.minutes} min`}</T>
          </View>
        ))}
        {tr && (
          <>
            <H style={s.h3}>Mobility / recovery flow</H>
            <T>{tr.mobility.flow.map((m) => m.name).join(" · ")}</T>
          </>
        )}
      </Page>

      <Page size="LETTER" style={s.page}>
        <Chrome x={x} />
        <H style={s.h1}>Nutrition guidance</H>
        <T style={s.disclaimer}>{x.disclaimer}</T>
        {!t ? (
          <T>{x.nutrition.blocked_reason ?? "Nutrition not generated."}</T>
        ) : (
          <>
            <Table
              cols={["", "Target", "Tolerance", "% of calories"]}
              widths={[30, 20, 20, 30]}
              rows={[
                ["Calories", `${t.calories} kcal`, `±${t.tolerance.calories} kcal`, "-"],
                ["Protein", `${t.protein_g} g`, `±${t.tolerance.protein_g} g`, `${t.protein_pct.toFixed(0)}%`],
                ["Carbohydrate", `${t.carbs_g} g`, `±${t.tolerance.carbs_g} g`, `${t.carbs_pct.toFixed(0)}%`],
                ["Fat", `${t.fat_g} g`, `±${t.tolerance.fat_g} g`, `${t.fat_pct.toFixed(0)}%`],
              ]}
            />
            <T style={{ marginTop: 4 }}>{x.nutrition.fiber_text}</T>
            <T>{x.nutrition.hydration_text}</T>
            <T>{x.nutrition.meals_guidance}</T>
            {e && (
              <>
                <H style={s.h2}>Energy balance (estimates)</H>
                <Table
                  cols={["Component", "kcal/day"]}
                  widths={[70, 30]}
                  rows={
                    e.mode === "measured"
                      ? [["Measured TDEE (wearable)", Math.round(e.measured_tdee ?? 0)], ["+ Program exercise (net)", Math.round(e.planned_exercise_kcal_per_day)], ["- Current baseline exercise", Math.round(e.baseline_exercise_kcal_per_day ?? 0)], ["Estimated TDEE", Math.round(e.tdee)], ["Target intake", Math.round(e.target_kcal)]]
                      : [["Resting (BMR)", Math.round(e.bmr)], ["Daily activity (non-exercise)", Math.round(e.nonexercise_kcal)], ["Strength (avg/day)", Math.round(e.strength_kcal_per_week / 7)], ["Cardio (avg/day)", Math.round(e.cardio_kcal_per_week / 7)], ["Mobility (avg/day)", Math.round(e.mobility_kcal_per_week / 7)], ["Food effect (TEF)", Math.round(e.tef_kcal ?? 0)], ["Estimated TDEE", Math.round(e.tdee)], ["Target intake", Math.round(e.target_kcal)]]
                  }
                />
                <T style={{ marginTop: 3 }}>{`Expected change: ${describePrediction(e)} (±${Math.round(e.uncertainty_pct * 100)}% TDEE uncertainty). 3,500 kcal per lb is a planning approximation only.`}</T>
              </>
            )}
            <H style={s.h2}>Example days — examples, swap freely</H>
            {x.nutrition.example_days.map((d) => (
              <View key={d.label} style={s.box} wrap={false}>
                <T style={BOLD}>{`${d.label} · ${d.totals.calories} kcal · P ${d.totals.protein_g} g · C ${d.totals.carbs_g} g · F ${d.totals.fat_g} g`}</T>
                {d.meals.map((m, i) => <T key={i}>{`${m.name}: ${m.items.map((it) => `${it.name}: ${it.household} (~${Math.round(it.grams)} g)`).join("; ")}`}</T>)}
              </View>
            ))}
            <H style={s.h2}>Swaps</H>
            {x.nutrition.swaps.map((sw) => <T key={sw.category}>{`${sw.category}: ${sw.options.slice(0, 8).map((o) => `${o.name}: ${o.household}`).join("; ")}`}</T>)}
            <H style={s.h2}>Food lists</H>
            {Object.entries(x.nutrition.food_lists).map(([cat, fs]) => <T key={cat}>{`${cat}: ${fs.map((f) => f.name).join(", ")}`}</T>)}
            <H style={s.h2}>Grocery staples</H>
            <T>{x.nutrition.grocery_staples.join(" · ")}</T>
          </>
        )}
        <T style={s.disclaimer}>{x.disclaimer}</T>
      </Page>

      <Page size="LETTER" orientation="landscape" style={s.page}>
        <Chrome x={x} />
        <H style={s.h1}>Calendar</H>
        <Table
          cols={["Week", ...(cal[0]?.days.map((d) => DAY_NAMES[d.weekday]) ?? [])]}
          widths={[9, 13, 13, 13, 13, 13, 13, 13]}
          rows={cal.map((w) => [`W${w.week}${w.deload ? " (deload)" : ""}`, ...w.days.map((d) => `${formatDate(d.date).replace(/, \d{4}$/, "")}\n${d.items.join("\n")}`)])}
        />
      </Page>
    </Document>
  );
}

export async function renderPlanPdf(x: ExportInput): Promise<Buffer> {
  return renderToBuffer(<PlanDocument x={x} />);
}

// ---------------------------------------------------------------------------
// Progress report
// ---------------------------------------------------------------------------

export interface ProgressReportInput {
  clientName: string;
  asOf: string;
  weekLabel: string;
  weight: { status: string; latest: string; trend: string; change: string; toGoal: string; rate: string; planned: string };
  weighIns: { date: string; weight: number; planned: number | null }[];
  adherence: { overall: string; sessions: string; cardio: string };
  measurements: { site: string; baseline: string; latest: string; change: string }[];
  lifts: { name: string; baseline: string; latest: string; pct: string; flag: boolean }[];
  benchmarks: { name: string; baseline: string; target: string; current: string; pct: string; status: string }[];
  calibrations: string[];
}

export function ProgressReport({ r }: { r: ProgressReportInput }) {
  return (
    <Document title={`${r.clientName} progress report`} author="Coach Console">
      <Page size="LETTER" style={s.page}>
        <Chrome x={{ clientName: r.clientName, status: "approved" }} />
        <H style={s.h1}>{`${r.clientName}: progress report`}</H>
        <T style={s.muted}>{`${formatDate(r.asOf)} · ${r.weekLabel}. Expected-change figures are estimates, not guarantees.`}</T>
        <H style={s.h2}>Weight</H>
        <T>{`Status: ${r.weight.status} · Latest ${r.weight.latest} · 7-day trend ${r.weight.trend} · Change ${r.weight.change} · To goal ${r.weight.toGoal} · Rate ${r.weight.rate} (planned ${r.weight.planned})`}</T>
        {r.weighIns.length > 0 && <Table cols={["Date", "Weight (lb)", "Planned (lb)"]} widths={[34, 33, 33]} rows={r.weighIns.slice(-12).map((w) => [formatDate(w.date), w.weight.toFixed(1), w.planned != null ? w.planned.toFixed(1) : "-"])} />}
        <H style={s.h2}>Adherence (last 14 days)</H>
        <T>{`Overall ${r.adherence.overall} · Sessions ${r.adherence.sessions} · Cardio ${r.adherence.cardio}`}</T>
        {r.measurements.length > 0 && (<><H style={s.h2}>Measurements (in)</H><Table cols={["Site", "Baseline", "Latest", "Change"]} widths={[25, 25, 25, 25]} rows={r.measurements.map((m) => [m.site, m.baseline, m.latest, m.change])} /></>)}
        {r.lifts.length > 0 && (<><H style={s.h2}>Strength (estimated 5RM)</H><Table cols={["Lift", "Baseline", "Latest", "% of baseline"]} widths={[40, 20, 20, 20]} rows={r.lifts.map((l) => [l.name, l.baseline, l.latest, `${l.pct}${l.flag ? " (check)" : ""}`])} /></>)}
        {r.benchmarks.length > 0 && (<><H style={s.h2}>Benchmarks</H><Table cols={["Benchmark", "Baseline", "Target", "Current", "% there", "Status"]} widths={[30, 13, 13, 13, 13, 18]} rows={r.benchmarks.map((b) => [b.name, b.baseline, b.target, b.current, b.pct, b.status])} /></>)}
        {r.calibrations.length > 0 && (<><H style={s.h2}>Checkpoints</H>{r.calibrations.map((c, i) => <T key={i}>{c}</T>)}</>)}
      </Page>
    </Document>
  );
}

export async function renderProgressPdf(r: ProgressReportInput): Promise<Buffer> {
  return renderToBuffer(<ProgressReport r={r} />);
}

// ---------------------------------------------------------------------------
// Client week sheet (client-facing: no calorie or energy numbers)
// ---------------------------------------------------------------------------

const g = StyleSheet.create({
  cell: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: RULE_STRONG, padding: 4, justifyContent: "center" },
  head: { ...CAPS, fontSize: 6.5, color: FERN, borderBottomColor: INK, borderBottomWidth: 0.75 },
  dayBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: INK, color: SAGE, paddingVertical: 5, paddingHorizontal: 7, ...DISPLAY, fontSize: 7.5 },
  line: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  box: { width: 8, height: 8, borderWidth: 0.75, borderColor: INK, marginRight: 6 },
  small: { fontSize: 7, color: FERN },
});

/** Log table: one row per exercise, one blank weight × reps cell per set. */
function SetLog({ exercises, sets }: { exercises: ClientWeekExercise[]; sets: number }) {
  const exW = 30;
  const tgtW = 22;
  const setW = (100 - exW - tgtW) / sets;
  return (
    <View style={{ borderLeftWidth: 0.5, borderTopWidth: 0.5, borderColor: RULE_STRONG, marginTop: 4 }}>
      <View style={{ flexDirection: "row" }} wrap={false}>
        <Text style={[g.cell, g.head, { width: `${exW}%` }]}>EXERCISE</Text>
        <Text style={[g.cell, g.head, { width: `${tgtW}%` }]}>TARGET</Text>
        {Array.from({ length: sets }, (_, i) => (
          <View key={i} style={[g.cell, g.head, { width: `${setW}%`, alignItems: "center" }]}>
            <Text>{`SET ${i + 1}`}</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: 400, fontSize: 6, color: FERN, marginTop: 2 }}>lb × reps</Text>
          </View>
        ))}
      </View>
      {exercises.map((e, k) => (
        <View key={k} style={{ flexDirection: "row", minHeight: 30 }} wrap={false}>
          <View style={[g.cell, { width: `${exW}%` }]}>
            <Text style={BOLD}>{pdfText(`${k + 1}. ${e.name}`)}</Text>
            {e.easier && <Text style={g.small}>{pdfText(`Easier: ${e.easier}`)}</Text>}
            {e.tip && <Text style={g.small}>{pdfText(`Tip: ${e.tip}`)}</Text>}
          </View>
          <View style={[g.cell, { width: `${tgtW}%` }]}>
            <Text>{pdfText(`${e.sets} × ${e.target}`)}</Text>
            <Text style={g.small}>{pdfText(`Rest ${e.rest} · Effort ${e.effort}`)}</Text>
          </View>
          {Array.from({ length: sets }, (_, i) => (
            <View key={i} style={[g.cell, { width: `${setW}%`, alignItems: "center" }, i >= e.sets ? { backgroundColor: RULE } : {}]}>
              {i < e.sets ? <Text style={{ fontSize: 9, color: RULE_STRONG }}>{e.unit === "seconds" ? "    ×    s" : "    ×    "}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const Check = ({ label }: { label: string }) => (
  <View style={g.line} wrap={false}>
    <View style={g.box} />
    <Text>{pdfText(label)}</Text>
  </View>
);

export function ClientWeekDocument({ w }: { w: ClientWeek }) {
  const sets = maxSets(w);
  return (
    <Document title={`${w.clientName} week ${w.week}`} author="Make Time To Move">
      <Page size="LETTER" style={s.page}>
        <View style={s.header} fixed>
          <LogoPdf mark={MONOGRAM} width={22} />
          <Text style={s.headerText}>{pdfText(`${w.clientName} · Week ${w.week} of ${w.totalWeeks}`)}{w.draft ? <Text style={{ color: INK }}>{"   DRAFT"}</Text> : null}</Text>
        </View>
        {w.draft && <Text style={s.watermark} fixed>DRAFT</Text>}
        <View style={s.footer} fixed>
          <Text>Stop any exercise that causes sharp pain and tell your coach.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
        <Text style={s.h1}>{displayText(`Week ${w.week}`)}</Text>
        <T style={s.muted}>{`${w.range} · ${w.phase}${w.deload ? " · Deload week: lighter on purpose, fewer sets, stop well short of failure" : ""}`}</T>
        <T style={[s.muted, { marginTop: 2 }] as never}>Write the weight and reps for every set (BW for bodyweight). Bring this back or send a photo.</T>
        {w.days.map((d) => {
          const parts = [d.strength?.name, d.cardio && "Cardio", d.mobility && "Mobility"].filter(Boolean) as string[];
          return (
            <View key={d.date} style={{ marginTop: 12 }} wrap={false}>
              <View style={g.dayBar}>
                <Text>{displayText(d.label)}</Text>
                <Text>{displayText(parts.length ? parts.join(" + ") : "Rest")}</Text>
              </View>
              {d.other.map((o, i) => <T key={i} style={[s.muted, { marginTop: 3 }] as never}>{`• ${o}`}</T>)}
              {d.strength && (
                <>
                  <T style={{ marginTop: 4 }}>{`Warm up 5–10 min, then about ${d.strength.minutes} min of work.`}</T>
                  <SetLog exercises={d.strength.exercises} sets={sets} />
                </>
              )}
              {d.cardio && <Check label={`Cardio: ${d.cardio}      Minutes done: ______`} />}
              {d.mobility && <Check label={`${d.mobility.text}: ${d.mobility.moves.join(", ")}`} />}
            </View>
          );
        })}
        <T style={s.disclaimer}>{EFFORT_NOTE}</T>
      </Page>
    </Document>
  );
}

export async function renderClientWeekPdf(w: ClientWeek): Promise<Buffer> {
  return renderToBuffer(<ClientWeekDocument w={w} />);
}
