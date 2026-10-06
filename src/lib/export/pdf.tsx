/**
 * Printable plan, progress-report and client-week PDFs (@react-pdf/renderer,
 * server-side), in the Make Time To Move Sage theme: Ink on Sage, Fern for
 * secondary text, hairline rules; MTTM Lettering for headings, Manrope for
 * body; monogram in the header.
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
import { blockOfWeek, holdSeconds, sessionsInBlock } from "@/lib/training";
import { DELOAD } from "@/config/training-variables";
import { SKILLS } from "@/config/skills";
import { skillSchedule } from "@/lib/skill-schedule";
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

// No "page X / Y" numbers: react-pdf (4.9) re-resolves a page's styles for
// every dynamic `render` node, multiplying the inherited line height by the
// font size each time, which crashes long plans with "unsupported number".
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
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Full program PDF
// ---------------------------------------------------------------------------

const ps = StyleSheet.create({
  section: { ...DISPLAY, fontSize: 10, marginTop: 18, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 0.75, borderBottomColor: INK },
  sub: { ...DISPLAY, fontSize: 8, marginTop: 12, marginBottom: 2 },
  label: { ...CAPS, fontSize: 6.5, color: FERN },
  tiles: { flexDirection: "row", marginTop: 10, marginBottom: 4 },
  tile: { flexGrow: 1, flexBasis: 0, borderTopWidth: 0.75, borderTopColor: INK, paddingTop: 5, marginRight: 10 },
  tileValue: { ...BOLD, fontSize: 11, marginTop: 2 },
  big: { ...BOLD, fontSize: 26, lineHeight: 1.1 },
  cell: { paddingRight: 4 },
  note: { fontSize: 7.5, color: FERN, marginTop: 3 },
  bullet: { flexDirection: "row", marginBottom: 2 },
});

function Tiles({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={ps.tiles} wrap={false}>
      {items.map((it, i) => (
        <View key={it.label} style={[ps.tile, i === items.length - 1 ? { marginRight: 0 } : {}] as never}>
          <Text style={ps.label}>{pdfText(it.label)}</Text>
          <Text style={ps.tileValue}>{pdfText(it.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function Bullets({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <View>
      {items.map((b, i) => (
        <View key={i} style={ps.bullet} wrap={false}>
          <Text style={[{ width: 10 }, muted ? s.muted : {}] as never}>•</Text>
          <Text style={[{ flex: 1 }, muted ? s.muted : {}] as never}>{pdfText(b)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Table whose cells may hold a main line and a muted second line. */
function Grid({ cols, widths, rows }: { cols: string[]; widths: number[]; rows: (string | { main: string; sub?: string; bold?: boolean })[][] }) {
  return (
    <View style={{ marginTop: 3 }}>
      <View style={[s.row, s.th]} wrap={false}>
        {cols.map((c, i) => <Text key={i} style={[ps.cell, { width: `${widths[i]}%` }] as never}>{pdfText(c)}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.map((c, j) => {
            const v = typeof c === "string" ? { main: c } : c;
            return (
              <View key={j} style={[ps.cell, { width: `${widths[j]}%` }] as never}>
                <Text style={v.bold ? BOLD : undefined}>{pdfText(v.main)}</Text>
                {v.sub ? <Text style={{ fontSize: 7, color: FERN }}>{pdfText(v.sub)}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const rxText = (rx: { sets: number; reps_min: number; reps_max: number }, unit: "reps" | "seconds") =>
  unit === "seconds" ? `${rx.sets} x ${holdSeconds(rx as never)[0]}-${holdSeconds(rx as never)[1]}s` : `${rx.sets} x ${rx.reps_min}-${rx.reps_max}`;
const range = (a: number, b: number) => (a === b ? `${a}` : `${a}-${b}`);
/** Drop descriptions in brackets and method notes after a dash: "Support Hold (parallel bars…)" -> "Support Hold". */
const shortName = (n: string) => n.replace(/\s*\([^)]*\)/g, "").replace(/\s+—.*$/, "");
const shortDate = (d: string) => formatDate(d).replace(/, \d{4}$/, "");

export function PlanDocument({ x }: { x: ExportInput }) {
  const p = x.parameters;
  const tpl = GOAL_TEMPLATES[x.goal];
  const t = x.nutrition.targets;
  const e = x.nutrition.energy;
  const tr = x.training;
  const cal = planCalendar(p, tr);
  const blocks = tr ? Array.from({ length: Math.ceil(tr.weeks.length / DELOAD.everyNWeeks) }, (_, b) => b) : [];
  const weeksOf = (b: number) => (tr ? tr.weeks.filter((w) => blockOfWeek(w.week) === b) : []);
  const cardio = tr?.cardio;
  const skill = tr?.skill ? SKILLS[tr.skill] : null;

  return (
    <Document title={`${x.clientName} plan v${x.version}`} author="Coach Console">
      {/* ---------------- Overview ---------------- */}
      <Page size="LETTER" style={s.page}>
        <Chrome x={x} />
        <H style={s.h1}>{`${x.clientName}: ${tpl.label} program`}</H>
        <T style={s.muted}>{`Starts ${formatDate(p.start_date)} · ${p.weeks} weeks · plan v${x.version}`}</T>
        <Tiles
          items={[
            { label: "Program", value: tr?.split_label ?? "On hold" },
            { label: "Training", value: tr ? `${tr.lifting_days.length} days/week · ~${p.session_length_min} min` : "-" },
            { label: "Training days", value: tr ? tr.lifting_days.map((d) => DAY_NAMES[d]).join(" ") : "-" },
            ...(skill ? [{ label: "Skill goal", value: skill.label }] : []),
          ]}
        />
        {x.clearanceNotes && (
          <View style={s.alert} wrap={false}>
            <T style={BOLD}>Physician clearance notes</T>
            <T>{x.clearanceNotes}</T>
          </View>
        )}

        {tr && (tr.split_reasons?.length || tr.program_summary) ? (
          <>
            <H style={ps.section}>Why this program</H>
            {tr.program_summary ? <T style={{ marginBottom: 4 }}>{tr.program_summary}</T> : null}
            <Bullets items={tr.split_reasons ?? []} />
          </>
        ) : null}

        {t && (
          <>
            <H style={ps.section}>Daily nutrition targets</H>
            <View style={{ flexDirection: "row" }} wrap={false}>
              <View style={{ width: "34%" }}>
                <Text style={ps.label}>Calories</Text>
                <Text style={ps.big}>{t.calories.toLocaleString("en-US")}</Text>
                <T style={s.muted}>{`kcal a day (${t.calories - t.tolerance.calories}-${t.calories + t.tolerance.calories})`}</T>
              </View>
              <View style={{ width: "66%" }}>
                <Tiles items={[{ label: "Protein", value: `${t.protein_g} g` }, { label: "Carbs", value: `${t.carbs_g} g` }, { label: "Fat", value: `${t.fat_g} g` }]} />
              </View>
            </View>
            {e && <T style={ps.note}>{`Expected change: ${describePrediction(e)} (estimate; recalibrated from weigh-ins).`}</T>}
          </>
        )}

        {tr && (
          <>
            <H style={ps.section}>The plan in phases</H>
            <Grid
              cols={["Weeks", "Phase", "Main lifts", "Effort (RPE)", "Notes"]}
              widths={[12, 22, 18, 14, 34]}
              rows={blocks.map((b) => {
                const ws = weeksOf(b);
                const ph = PHASES[ws[0].phase];
                const deload = ws.find((w) => w.deload);
                return [
                  `${ws[0].week}-${ws[ws.length - 1].week}`,
                  { main: ph.label, bold: true },
                  `${range(ph.setsMin, ph.setsMax)} sets x ${range(ph.repsMin, ph.repsMax)}`,
                  range(ph.rpe[0], ph.rpe[1]),
                  deload ? `Week ${deload.week}: deload, ~40% fewer sets, RPE 5-6; retest at the last session.` : "",
                ];
              })}
            />
            {skill && (
              <View wrap={false}>
                <H style={ps.section}>{`${skill.label} progression`}</H>
                <T style={{ marginBottom: 2 }}>{`Every training day starts with the ${skill.label.toLowerCase()} step while fresh, plus ${skill.label.toLowerCase()} prep work (marked in the training tables).`}</T>
                <Grid
                  cols={["Step", "Exercise", "Weeks"]}
                  widths={[12, 63, 25]}
                  rows={skillSchedule(tr).map((st) => [`${st.step}${st.step === skill.ladder.length ? " (goal)" : ""}`, { main: st.name, bold: st.weeks != null }, st.weeks ?? "next plan / move up early"])}
                />
                <T style={ps.note}>{skill.progressCue}</T>
              </View>
            )}
          </>
        )}

        {!tr && (
          <>
            <H style={ps.section}>Programming guidelines</H>
            <Bullets items={tpl.guidelines} muted />
          </>
        )}
      </Page>

      {/* ---------------- Training ---------------- */}
      {tr && (
        <Page size="LETTER" style={s.page}>
          <Chrome x={x} />
          <H style={s.h1}>Training</H>
          <T style={s.muted}>Sets x reps for each week (holds in seconds). Easier and harder options are under each exercise. Warm up 5-10 minutes first.</T>
          {blocks.map((b) => {
            const ws = weeksOf(b);
            const sessions = sessionsInBlock(tr.sessions, b).filter((ss) => ws.some((w) => tr.rotation.length && Object.keys(w.session_minutes).includes(ss.key)));
            const weekW = Math.floor(44 / ws.length);
            return (
              <View key={b}>
                <H style={ps.section} minPresenceAhead={120}>{`Weeks ${ws[0].week}-${ws[ws.length - 1].week} · ${PHASES[ws[0].phase].label}`}</H>
                {sessions.map((ss) => {
                  const slots = ss.slots.filter((sl) => ws.some((w) => w.prescriptions[sl.id]));
                  const first = ws.find((w) => !w.deload) ?? ws[0];
                  const rpes = slots.flatMap((sl) => ws.map((w) => w.prescriptions[sl.id]).filter(Boolean));
                  return (
                    <View key={ss.key} style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }} wrap={false} minPresenceAhead={60}>
                        <H style={ps.sub}>{ss.name}</H>
                        <Text style={{ fontSize: 7, color: FERN }}>{`~${first.session_minutes[ss.key] ?? "-"} min + warm-up`}</Text>
                      </View>
                      <Grid
                        cols={["Exercise", ...ws.map((w) => `Wk ${w.week}${w.deload ? " (D)" : ""}`), "Rest", "RPE"]}
                        widths={[100 - weekW * ws.length - 18, ...ws.map(() => weekW), 8, 10]}
                        rows={slots.map((sl) => {
                          const rx0 = first.prescriptions[sl.id] ?? ws.map((w) => w.prescriptions[sl.id]).find(Boolean)!;
                          const r = ws.map((w) => w.prescriptions[sl.id]).filter(Boolean);
                          const tag = sl.skill ? `${SKILLS[sl.skill].label}${sl.role === "skill" ? "" : " prep"} · ` : sl.focus ? "Focus · " : "";
                          const alt = [sl.regression ? `Easier: ${shortName(sl.regression.name)}` : "", sl.progression ? `Harder: ${shortName(sl.progression.name)}` : ""].filter(Boolean).join(" · ");
                          return [
                            { main: `${tag}${sl.exercise.name}`, sub: alt || undefined, bold: Boolean(sl.skill) || sl.role === "main" },
                            ...ws.map((w) => (w.prescriptions[sl.id] ? rxText(w.prescriptions[sl.id], sl.unit) : "-")),
                            `${rx0.rest_sec}s`,
                            range(Math.min(...r.map((q) => q.rpe_min)), Math.max(...r.map((q) => q.rpe_max))),
                          ];
                        })}
                      />
                      {rpes.length === 0 && <T style={s.muted}>No exercises this block.</T>}
                    </View>
                  );
                })}
              </View>
            );
          })}

          <H style={ps.section} minPresenceAhead={100}>Cardio and recovery</H>
          {cardio?.removed ? (
            <T>{`Cardio: not prescribed yet${cardio.removed_reason ? ` (${cardio.removed_reason.replace(/\.$/, "")})` : ""}.`}</T>
          ) : cardio ? (
            <>
              <T>{`${METS[cardio.activity].label}${cardio.hr_bpm ? ` · heart rate ${cardio.hr_bpm.min}-${cardio.hr_bpm.max} bpm` : ""} · effort ${cardio.rpe} · ${cardio.intensity}`}</T>
              <Grid
                cols={["Weeks", "Sessions / week", "Minutes each"]}
                widths={[30, 35, 35]}
                rows={blocks.map((b) => {
                  const ws = weeksOf(b).map((w) => cardio.weeks[w.week - 1]).filter(Boolean);
                  return [`${ws[0]?.week}-${ws[ws.length - 1]?.week}`, range(Math.min(...ws.map((c) => c.sessions)), Math.max(...ws.map((c) => c.sessions))), range(Math.min(...ws.map((c) => c.minutes)), Math.max(...ws.map((c) => c.minutes)))];
                })}
              />
            </>
          ) : null}
          {tr.mobility.sessions_per_week > 0 && (
            <View style={{ marginTop: 6 }} wrap={false}>
              <T style={BOLD}>{`Mobility: ${tr.mobility.sessions_per_week} x ${tr.mobility.minutes} min a week (${tr.mobility.days.map((d) => DAY_NAMES[d]).join(", ")})`}</T>
              <T style={s.muted}>{tr.mobility.flow.map((m) => m.name).join(" · ")}</T>
            </View>
          )}

          <View wrap={false}>
            <H style={ps.section}>Coaching notes</H>
            <Bullets items={[...(tr.coaching_notes ?? []), ...tpl.guidelines]} muted />
          </View>
        </Page>
      )}

      {/* ---------------- Nutrition ---------------- */}
      <Page size="LETTER" style={s.page}>
        <Chrome x={x} />
        <H style={s.h1}>Nutrition</H>
        {!t ? (
          <T>{x.nutrition.blocked_reason ?? "Nutrition not generated."}</T>
        ) : (
          <>
            <Tiles
              items={[
                { label: "Calories", value: `${t.calories} kcal (±${t.tolerance.calories})` },
                { label: "Protein", value: `${t.protein_g} g (±${t.tolerance.protein_g})` },
                { label: "Carbs", value: `${t.carbs_g} g (±${t.tolerance.carbs_g})` },
                { label: "Fat", value: `${t.fat_g} g (±${t.tolerance.fat_g})` },
              ]}
            />
            <Tiles
              items={[
                { label: "Meals", value: `${x.nutrition.meals_per_day} a day · ~${Math.round(t.protein_g / x.nutrition.meals_per_day)} g protein each` },
                { label: "Fiber", value: `${t.fiber_g} g a day` },
                { label: "Water", value: t.water ? `~${t.water.from_drinks_fl_oz} fl oz from drinks` : "-" },
              ]}
            />

            <H style={ps.section}>Example days</H>
            <T style={s.muted}>Examples only. Swap foods freely using the swaps below.</T>
            {x.nutrition.example_days.map((d) => (
              <View key={d.label} style={{ marginTop: 8 }} wrap={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <H style={ps.sub}>{d.label.replace(/\s*[—-]\s*example.*$/i, "")}</H>
                  <Text style={{ fontSize: 7, color: FERN, marginTop: 12 }}>{`${d.totals.calories} kcal · P ${d.totals.protein_g} · C ${d.totals.carbs_g} · F ${d.totals.fat_g}`}</Text>
                </View>
                {d.meals.map((m, i) => (
                  <View key={i} style={[s.row, { paddingVertical: 2 }] as never}>
                    <Text style={[ps.label, { width: "18%", paddingTop: 1.5 }] as never}>{pdfText(m.name)}</Text>
                    <Text style={{ width: "82%" }}>{pdfText(m.items.map((it) => `${it.name} (${it.household})`).join(" · "))}</Text>
                  </View>
                ))}
              </View>
            ))}

            <H style={ps.section} minPresenceAhead={100}>Swaps</H>
            <Grid
              cols={["Food group", "Equal swaps"]}
              widths={[22, 78]}
              rows={x.nutrition.swaps.map((sw) => [{ main: sw.category, bold: true }, sw.options.slice(0, 8).map((o) => `${o.name} (${o.household})`).join(" · ")])}
            />
            <H style={ps.section} minPresenceAhead={80}>Foods that fit</H>
            <Grid cols={["Group", "Foods"]} widths={[22, 78]} rows={Object.entries(x.nutrition.food_lists).map(([cat, fs]) => [{ main: cat.charAt(0).toUpperCase() + cat.slice(1), bold: true }, fs.map((f) => f.name).join(" · ")])} />
            <H style={ps.section} minPresenceAhead={60}>Grocery staples</H>
            <T>{x.nutrition.grocery_staples.join(" · ")}</T>

            {e && (
              <View wrap={false}>
                <H style={ps.section}>How the numbers are worked out</H>
                <Grid
                  cols={["Component", "kcal / day"]}
                  widths={[70, 30]}
                  rows={
                    e.mode === "measured"
                      ? [["Measured TDEE (wearable)", String(Math.round(e.measured_tdee ?? 0))], ["+ Program exercise (net)", String(Math.round(e.planned_exercise_kcal_per_day))], ["- Current baseline exercise", String(Math.round(e.baseline_exercise_kcal_per_day ?? 0))], [{ main: "Estimated daily burn (TDEE)", bold: true }, { main: String(Math.round(e.tdee)), bold: true }], [{ main: "Target intake", bold: true }, { main: String(Math.round(e.target_kcal)), bold: true }]]
                      : [["Resting (BMR)", String(Math.round(e.bmr))], ["Daily activity (non-exercise)", String(Math.round(e.nonexercise_kcal))], ["Strength (avg/day)", String(Math.round(e.strength_kcal_per_week / 7))], ["Cardio (avg/day)", String(Math.round(e.cardio_kcal_per_week / 7))], ["Mobility (avg/day)", String(Math.round(e.mobility_kcal_per_week / 7))], ["Food effect (TEF)", String(Math.round(e.tef_kcal ?? 0))], [{ main: "Estimated daily burn (TDEE)", bold: true }, { main: String(Math.round(e.tdee)), bold: true }], [{ main: "Target intake", bold: true }, { main: String(Math.round(e.target_kcal)), bold: true }]]
                  }
                />
                <T style={ps.note}>{`Protein ${t.protein_g_per_lb.toFixed(2)} g per lb of ${t.reference_weight_lb} lb reference weight. ±${Math.round(e.uncertainty_pct * 100)}% uncertainty; 3,500 kcal per lb is a planning approximation only.`}</T>
              </View>
            )}
          </>
        )}
        <T style={s.disclaimer}>{x.disclaimer}</T>
      </Page>

      {/* ---------------- Calendar ---------------- */}
      <Page size="LETTER" orientation="landscape" style={s.page}>
        <Chrome x={x} />
        <H style={s.h1}>Calendar</H>
        <Grid
          cols={["Week", ...(cal[0]?.days.map((d) => DAY_NAMES[d.weekday]) ?? [])]}
          widths={[9, 13, 13, 13, 13, 13, 13, 13]}
          rows={cal.map((w) => [
            { main: `W${w.week}`, sub: w.deload ? "deload" : w.phase ? PHASES[w.phase as keyof typeof PHASES].label : undefined, bold: true },
            ...w.days.map((d) => ({ main: shortDate(d.date), sub: d.items.map(calLabel).join("\n") || undefined })),
          ])}
        />
      </Page>
    </Document>
  );
}

/** Short calendar labels: "Strength: Full Body A" -> "Full Body A", etc. */
function calLabel(item: string): string {
  return item
    .replace(/^Strength: /, "")
    .replace(/^Cardio: (.+?) (\d+) min/, (_m, a: string, n: string) => `Cardio ${n} min (${a.replace(/,.*$/, "")})`)
    .replace(/^Mobility\/recovery (\d+) min/, "Mobility $1 min")
    .replace(/^Day 1: baseline weigh-in and measurements/, "Baseline weigh-in + measurements");
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
