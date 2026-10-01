# Coach Console

A private, single-trainer web app for an ISSA-certified personal trainer:

1. It generates a training program and nutrition **guidance** for each client from an intake, then lets the trainer customize it.
2. It shows a daily and weekly list of what needs attention across all clients.

Only the trainer logs in. Clients never use the app, and nothing is ever sent to clients in v1.

Stack: Next.js 14 (App Router, TypeScript), Tailwind, Supabase (Postgres + Auth, RLS on every table), Anthropic API (Claude) for drafting exercise picks and notes, Resend for the digest email, exceljs (.xlsx) and @react-pdf/renderer (PDF), Recharts. It deploys to Vercel.

> Coach Console has its own repo, its own Vercel project and its own Supabase project. It shares nothing with the fridge app.

## How the operating principles are enforced in code

| Principle | Where |
|---|---|
| Every plan is a DRAFT until Approve; no sending anywhere | `plans.status`; `approvePlanAction` (src/app/actions/plans.ts) is the only way to approve; exports carry a DRAFT header and watermark until approval; there is no client-facing send path |
| All numbers come from deterministic, unit-tested code | `src/lib/energy.ts`, `nutrition.ts`, `guardrails.ts`, `calibration.ts`, `training.ts`, `example-days.ts`, `progress.ts`, `tasks.ts` |
| The LLM only picks exercises from the library and writes short notes | `src/lib/selection.ts`: candidates are pre-filtered by equipment, contraindications and dislikes; zod validates the output; choices must come from each slot's candidate list; notes **may not contain digits**; one retry, then an error (nothing unvalidated is saved) |
| Nutrition = exact targets + tolerance bands; example days land in every band | `computeMacroTargets` (4P+4C+9F within 2 kcal); `buildExampleDays` discards any day outside a band |
| Disclaimer on every nutrition page and export | Settings → disclaimer; rendered on the Nutrition tab, in the PDF and in 5 workbook tabs |
| Honest about accuracy | Every expenditure and prediction figure is labeled an estimate, with an ~80% band; 3,500 kcal/lb is labeled a planning approximation; the band narrows to ±5% after calibration |
| Refer out, don't advise | `src/lib/intake.ts` `blockedSections`: eating-disorder and medical flags block nutrition, acute injury blocks training, until handling is recorded. Injury and medical text is never sent to the LLM |
| PAR-Q gate | Any "yes" flags NEEDS PHYSICIAN CLEARANCE. `clearanceIssue` blocks approval until status is received (with notes) or not required (with a reason). Clearance notes print at the top of the training plan; an RPE ceiling caps every prescription and an HR ceiling caps the cardio zone |

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
```

### Supabase

1. Create a project and run `supabase/migrations/0001_schema.sql` (SQL editor, or `supabase db push`).
2. **Authentication → Providers → Email: turn OFF "Allow new users to sign up"** (also set in `supabase/config.toml`). RLS already limits all data to the single `app_owner` user; this setting just keeps strangers from creating accounts at all.
3. Seed the libraries, the core metrics, the default settings and the trainer login:

   ```bash
   TRAINER_EMAIL=you@example.com TRAINER_PASSWORD='a-strong-password' npm run seed
   npm run seed:samples   # optional: two sample clients (weight loss + performance)
   ```

### Environment variables

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; used only by the cron digest and the seed scripts |
| `ANTHROPIC_API_KEY` | Exercise selection and notes (model `claude-opus-5-5`, override with `ANTHROPIC_MODEL`) |
| `RESEND_API_KEY`, `TRAINER_EMAIL` | Digest email. Set `DIGEST_FROM` to a sender on a domain verified in Resend |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` to `/api/cron/digest` |
| `NEXT_PUBLIC_APP_URL` | Links in the digest |
| `TRAINER_TIMEZONE` | IANA zone (default `America/New_York`). Used for "today", Monday-noon overdue weigh-ins and the 7 AM digest |

### Run

```bash
npm run dev             # http://localhost:3000
npm test                # 128 unit tests (energy, guardrails, macros, calibration, training, example days, progress, tasks, metrics, selection, generator)
npm run typecheck && npm run lint
npm run verify:xlsx     # builds both sample workbooks, recalculates them in LibreOffice, fails on any formula error or on a mismatch with the app
npm run verify:pdf      # renders plan and progress-report PDFs to exports-check/
node scripts/e2e-smoke.mjs   # Playwright smoke test against a running app with the sample clients seeded
```

## Deploy (Vercel)

1. Vercel → Add New → Project → import `coach-console` (default settings; the app is at the repo root).
2. Add every environment variable above to Production.
3. `vercel.json` schedules `/api/cron/digest?kind=weekly` on Mondays and `?kind=daily` every day. Each fires at 11:00 and 12:00 UTC, and the route sends only when it's 7 AM in `TRAINER_TIMEZONE`, which covers daylight-saving changes. The daily digest is off unless enabled in Settings. The Vercel Hobby plan limits cron frequency, so use Pro, or drop the daily entry.
4. After deploying, sign in and check Settings. For a manual test, trigger the digest with `curl -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/digest?kind=weekly&force=1"`.

## Pages

`/login` · `/today` · `/clients` · `/clients/new` · `/clients/[id]` (profile, banners, current plan, quick-add, checkpoints, contact log, overrides) · `/clients/[id]/intake` · `/clients/[id]/plan/[planId]` (Overview, Training, Nutrition Guidance, Calendar, Checkpoints; override flow; Approve; exports) · `/clients/[id]/calibrate` · `/clients/[id]/progress` · `/clients/[id]/entry` (grid with arrow keys and spreadsheet paste) · `/clients/[id]/session` (set-by-set log) · `/entry` (weekly round) · `/progress` (all clients) · `/settings`, `/settings/metrics`, `/settings/exercises`, `/settings/foods`.

## Decisions to review

- **Default weight-loss deficit vs. loss-rate guardrail.** The spec's default deficit (400 kcal/day) predicts about 0.8 lb/week, which is below the 1–2 lb/week guardrail. Every default weight-loss plan therefore starts with a *warn* that needs an override reason. The same happens for muscle gain: a 300 kcal surplus ≈ 2.6 lb/month, above 1–2 lb/month. The defaults are editable in **Settings → Default calorie balance**. For weight loss, 500 keeps the default plan warning-free. I followed the spec literally rather than choosing for you.
- **Reference workbook.** `/reference/CMR-12-Week-Fat-Loss-Program-v2.xlsx` wasn't in the repo, so the food library (91 foods) uses USDA values, and the export follows the tab structure described in the spec. Add the workbook and I can re-seed foods from its Food Database tab and match its layout exactly.
- **MET values and phase variables** are seeded from the spec (Compendium / ISSA). Please confirm them against the ISSA text (`src/config/energy.ts`, `src/config/training-variables.ts`).
- **Session length.** Minutes = Σ sets × (time under load + rest), per spec, plus 8 minutes reserved for warm-up when fitting a session into the client's available time. If a 4-week block doesn't fit, rest drops to the low end of the phase range, then the lowest-priority exercises sit out that block. Endurance week 1 starts at 1 set (textbook range 1–3), so early sessions are short; edit sets on the Training tab if you want more.
- **Energy model week.** At generation, planned exercise uses week 1 of the program (conservative). At each calibration it is recomputed with the current weight and that week's program.
- **Small additions to the schema** needed by listed features: `app_owner` (single-user RLS), `referrals` (how each refer-out flag was handled), extra clearance fields (limits, HR/RPE ceilings), `tasks.snoozed_until`, `entry_reviews` (the weekly round's "mark reviewed"), `calibrations.applied_adjustment_kcal`, and `slug`/household-unit columns on the libraries.
- **Not built (listed as "later/optional"):** workbook import and Google Sheets sync.
