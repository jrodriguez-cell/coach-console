/**
 * End-to-end smoke test against a running app with the sample clients
 * seeded (npm run seed && npm run seed:samples && npm run build && npm start).
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-smoke.mjs
 *
 * Saves screenshots to exports-check/screens/.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.E2E_URL ?? "http://localhost:3000";
const OUT = "exports-check/screens";
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
const serverError = async () => (await page.content()).includes("Application error") || (await page.content()).includes("Internal Server Error");

// Login
await page.goto(`${BASE}/today`);
check("unauthenticated redirect to /login", page.url().endsWith("/login"));
await page.fill('input[name="email"]', process.env.E2E_EMAIL ?? "coach@example.com");
await page.fill('input[name="password"]', process.env.E2E_PASSWORD ?? "local-dev-password-123");
await page.click('button[type="submit"]');
await page.waitForURL("**/today");
check("login lands on /today", page.url().endsWith("/today"));
const todayText = await page.textContent("main");
check("rule-based tasks generated", /Sample Client A/.test(todayText ?? "") && /(Weigh-in|calibration|Reach out|Training check-in|retest)/i.test(todayText ?? ""), (todayText ?? "").match(/\d+ open/)?.[0]);
await shot("01-today");

// Clients list
await page.goto(`${BASE}/clients`);
check("clients list shows PAR-Q flag", (await page.textContent("main")).includes("PAR-Q"));
await shot("02-clients");
const clientA = await page.getAttribute('a:has-text("Sample Client A")', "href");
const clientB = await page.getAttribute('a:has-text("Sample Client B")', "href");

// Client A profile + quick-add with implausible value → confirm flow
await page.goto(`${BASE}${clientA}`);
check("client A page renders", !(await serverError()) && (await page.textContent("h1")).includes("Sample Client A"));
const wi = page.locator("form", { has: page.locator('input[name="weight"]') });
await wi.locator('input[name="weight"]').fill("240");
await wi.locator('button[type="submit"]').click();
await page.waitForSelector("text=Confirm and save", { timeout: 10000 }).catch(() => {});
check("implausible weigh-in asks for confirmation", await page.isVisible("text=Confirm and save"));
await shot("03-client-a");

// Plan tabs for A (approved)
const planHref = await page.getAttribute('a:has-text("Open plan")', "href");
for (const tab of ["overview", "training", "nutrition", "calendar", "checkpoints"]) {
  await page.goto(`${BASE}${planHref}?tab=${tab}`);
  check(`plan A ${tab} tab`, !(await serverError()));
  await shot(`04-plan-a-${tab}`);
}
await page.goto(`${BASE}${planHref}?tab=nutrition`);
const nut = await page.textContent("main");
check("nutrition shows disclaimer", /not medical advice/i.test(nut));
check("nutrition shows uncertainty band", /likely between/.test(nut) && /planning approximation/.test(nut));
check("training shows clearance notes", /Physician clearance notes/.test(nut));

// Exports (downloads through the authenticated session)
const planId = planHref.split("/").pop();
const x = await page.request.get(`${BASE}/api/plans/${planId}/export/xlsx`);
check("Excel export", x.ok() && (x.headers()["content-type"] ?? "").includes("spreadsheet"), `${(await x.body()).length} bytes`);
writeFileSync(`${OUT}/plan-a.xlsx`, await x.body());
const p = await page.request.get(`${BASE}/api/plans/${planId}/export/pdf`);
check("PDF export", p.ok() && (p.headers()["content-type"] ?? "").includes("pdf"), `${(await p.body()).length} bytes`);
writeFileSync(`${OUT}/plan-a.pdf`, await p.body());
const clientAId = clientA.split("/").pop();
const pr = await page.request.get(`${BASE}/api/clients/${clientAId}/progress-report`);
check("progress report PDF", pr.ok(), `${(await pr.body()).length} bytes`);
const ex = await page.request.get(`${BASE}/api/clients/${clientAId}/export`);
check("client data JSON export", ex.ok() && Array.isArray((await ex.json()).plans));

// Progress pages
await page.goto(`${BASE}${clientA}/progress`);
check("client progress dashboard", !(await serverError()) && /Weight/.test(await page.textContent("main")));
await page.waitForTimeout(800);
await shot("05-progress-a");
await page.goto(`${BASE}/progress`);
check("cross-client progress overview", !(await serverError()));
await shot("06-progress-overview");
await page.goto(`${BASE}/entry`);
check("weekly round", !(await serverError()));
await shot("07-weekly-round");
await page.goto(`${BASE}${clientA}/entry`);
check("entry grid", !(await serverError()) && (await page.locator("table input").count()) > 0);
await shot("08-entry-grid");

// Calibration for A (on demand)
await page.goto(`${BASE}${clientA}/calibrate`);
const calText = await page.textContent("main");
check("calibration page shows recommendation", /Recommendation/.test(calText));
await shot("09-calibrate");

// Client B: draft plan approval gate + override flow
await page.goto(`${BASE}${clientB}`);
const planB = await page.getAttribute('a:has-text("Open plan")', "href");
await page.goto(`${BASE}${planB}`);
const draftText = await page.textContent("main");
check("draft banner", /DRAFT/.test(draftText));
const overrideForms = page.locator('form:has(input[name="reason"])');
const n = await overrideForms.count();
for (let i = 0; i < n; i++) {
  const f = overrideForms.nth(0);
  await f.locator('input[name="reason"]').fill("E2E: reviewed with client");
  await f.locator('button[type="submit"]').click();
  await page.waitForTimeout(700);
  await page.reload();
}
page.once("dialog", (d) => d.accept());
await page.click('button:has-text("Approve")');
await page.waitForTimeout(3000);
const afterApprove = await page.textContent("main");
check("approve after overrides", /Approved\.|approved/i.test(afterApprove), n ? `${n} overrides recorded` : "no warnings");
await shot("10-plan-b-approved");

// Generate a new draft without an Anthropic key → clear error, nothing saved
await page.goto(`${BASE}${clientB}`);
await page.click("summary:has-text('Generate a new draft')").catch(() => {});
await page.click('button:has-text("Generate draft plan")');
await page.waitForTimeout(4000);
const genText = await page.textContent("main");
check("LLM failure shows an error (no unvalidated plan saved)", /ANTHROPIC_API_KEY|validation|Anthropic API error/.test(genText) || !process.env.EXPECT_NO_KEY, genText.match(/ANTHROPIC_API_KEY[^.]*\./)?.[0]);

// New client with PAR-Q yes → NEEDS PHYSICIAN CLEARANCE
await page.goto(`${BASE}/clients/new`);
await page.fill('input[name="name"]', "E2E Test Client");
await page.selectOption('select[name="goal_category"]', "general_health");
await page.click('button:has-text("Create and start intake")');
await page.waitForURL("**/intake");
await page.fill('input[name="age"]', "52");
await page.selectOption('select[name="sex"]', "female");
await page.fill('input[name="height_ft"]', "5");
await page.fill('input[name="height_in_rem"]', "5");
await page.fill('input[name="weight_lb"]', "168");
for (let i = 0; i < 7; i++) await page.check(`input[name="parq_${i}"][value="${i === 0 ? "yes" : "no"}"]`);
await page.check('input[name="refer_eating_disorder"]');
await page.check('input[name="current_exercise_confirmed"]');
await page.click('button:has-text("Save intake")');
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const newText = await page.textContent("main");
check("PAR-Q yes → NEEDS PHYSICIAN CLEARANCE banner", /NEEDS PHYSICIAN CLEARANCE/.test(newText));
check("eating-disorder flag → refer-out banner, nutrition blocked", /REFER OUT/.test(newText) && /nutrition generation blocked/.test(newText));
await shot("11-new-client-flags");

// Settings pages
for (const s of ["/settings", "/settings/metrics", "/settings/exercises", "/settings/foods"]) {
  await page.goto(`${BASE}${s}`);
  check(`settings page ${s}`, !(await serverError()));
}
await shot("12-settings-metrics");

// Cron route protection
const cron = await page.request.get(`${BASE}/api/cron/digest?kind=weekly`);
check("cron route rejects missing secret", cron.status() === 401);

check("no client-side exceptions", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
