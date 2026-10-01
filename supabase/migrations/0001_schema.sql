-- Coach Console schema. Single trainer; every table is RLS-protected so only
-- the authenticated trainer (the one row in app_owner) can read or write.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Owner / access control
-- ---------------------------------------------------------------------------
create table app_owner (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_owner where user_id = auth.uid());
$$;
revoke all on function is_trainer() from public;
grant execute on function is_trainer() to authenticated;

-- The first account to sign in becomes the trainer (only if no trainer exists yet).
create or replace function claim_trainer() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from app_owner where user_id = auth.uid()) then return true; end if;
  if exists (select 1 from app_owner) then return false; end if;
  insert into app_owner (user_id) values (auth.uid());
  return true;
end $$;
revoke all on function claim_trainer() from public;
grant execute on function claim_trainer() to authenticated;

-- ---------------------------------------------------------------------------
-- Clients and intake
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  status text not null default 'prospect' check (status in ('prospect','active','paused','completed')),
  goal_category text not null check (goal_category in ('general_health','muscle_gain','weight_loss','performance')),
  purpose_text text,
  start_date date,
  created_at timestamptz not null default now()
);

create table intakes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  answers jsonb not null,
  parq_answers jsonb not null,
  parq_flagged boolean not null default false,
  refer_out_flags jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);
create index intakes_client_idx on intakes(client_id, submitted_at desc);

create table clearances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  status text not null check (status in ('pending','received','not_required')),
  notes text,
  reason text,                 -- required when status = not_required
  exercise_limits text,
  hr_ceiling int,
  rpe_ceiling numeric,
  activities_to_avoid text,
  requested_at date,
  received_at date,
  created_at timestamptz not null default now()
);
create index clearances_client_idx on clearances(client_id, created_at desc);

-- How each refer-out flag was handled (unblocks generation of that section).
create table referrals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  flag text not null check (flag in ('injury','acute_injury','medical_condition','eating_disorder','mental_health')),
  handled_note text not null,
  handled_at timestamptz not null default now()
);
create index referrals_client_idx on referrals(client_id);

-- ---------------------------------------------------------------------------
-- Libraries
-- ---------------------------------------------------------------------------
create table exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  pattern text not null,
  primary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  contraindications text[] not null default '{}',
  regression_id uuid references exercises(id) on delete set null,
  progression_id uuid references exercises(id) on delete set null,
  is_compound boolean not null default false,
  video_url text
);

create table foods (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  category text not null check (category in ('protein','carb','fat','vegetable','fruit','dairy','other')),
  per_100g_cal numeric not null,
  per_100g_protein numeric not null,
  per_100g_carb numeric not null,
  per_100g_fat numeric not null,
  household_portion_text text,
  household_unit text not null default 'g',
  household_g numeric not null default 1,
  allergens text[] not null default '{}',
  dietary_tags text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
create table plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  version int not null,
  goal_category text not null,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  parameters jsonb not null,
  training jsonb,
  nutrition jsonb,
  guardrail_flags jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (client_id, version)
);
create index plans_client_idx on plans(client_id, version desc);

create table guardrail_overrides (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  rule_key text not null,
  original_value text,
  override_value text,
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);
create index guardrail_overrides_plan_idx on guardrail_overrides(plan_id);

create table energy_models (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  mode text not null check (mode in ('formula','measured')),
  inputs jsonb not null,
  outputs jsonb not null,
  uncertainty_pct numeric not null,
  created_at timestamptz not null default now()
);
create index energy_models_plan_idx on energy_models(plan_id, created_at desc);

create table checkpoints (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  week int not null,
  kind text not null check (kind in ('weigh_in','measurements','retest','review')),
  due_date date not null,
  completed_at timestamptz,
  result jsonb
);
create index checkpoints_client_idx on checkpoints(client_id, due_date);

create table calibrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  checkpoint_id uuid references checkpoints(id) on delete set null,
  period_start date not null,
  period_end date not null,
  weigh_in_points int not null,
  observed_lb_per_week numeric,
  planned_lb_per_week numeric,
  adherence_pct numeric,
  implied_daily_balance numeric,
  recommended_adjustment_kcal numeric,
  decision text not null check (decision in ('keep','adjust','fix_adherence','insufficient_data')),
  applied_adjustment_kcal numeric,
  trainer_decision_note text,
  created_at timestamptz not null default now()
);
create index calibrations_client_idx on calibrations(client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Contact, measurements, benchmarks, training log
-- ---------------------------------------------------------------------------
create table contact_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  channel text not null check (channel in ('text','email','call','in_person')),
  summary text,
  created_at timestamptz not null default now()
);
create index contact_log_client_idx on contact_log(client_id, date desc);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  site text not null,
  value_in numeric not null,
  source text not null default 'coach_entered',
  unique (client_id, date, site)
);

create table benchmarks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  name text not null,
  category text not null check (category in ('body','strength','cardio','skill','mobility','sport','habit')),
  unit text,
  direction text not null check (direction in ('higher_better','lower_better')),
  baseline numeric,
  target numeric,
  target_date date,
  metric_id uuid,
  created_at timestamptz not null default now()
);

create table benchmark_results (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid not null references benchmarks(id) on delete cascade,
  date date not null,
  value numeric not null,
  note text,
  source text not null default 'coach_entered'
);
create index benchmark_results_idx on benchmark_results(benchmark_id, date);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  date date not null,
  planned_session_key text,
  status text not null check (status in ('completed','partial','missed','rest_swap')),
  duration_min int,
  avg_rpe numeric,
  notes text,
  source text not null default 'coach_entered'
);
create index workout_sessions_client_idx on workout_sessions(client_id, date desc);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_number int not null,
  weight_lb numeric,
  reps int,
  rpe numeric,
  is_test boolean not null default false
);
create index set_logs_session_idx on set_logs(session_id);

-- ---------------------------------------------------------------------------
-- Configurable metrics
-- ---------------------------------------------------------------------------
create table metric_definitions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  type text not null check (type in ('number','scale_1_10','boolean','time','text')),
  unit text,
  frequency text not null check (frequency in ('daily','weekly','checkpoint','ad_hoc')),
  applies_to text[] not null default '{all}',
  is_core boolean not null default false,
  required boolean not null default false,
  active boolean not null default true,
  show_in_charts boolean not null default true,
  used_by_task_rule boolean not null default false,
  display_order int not null default 100,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

-- Core metrics can be hidden/optional but never deleted.
create or replace function prevent_core_metric_delete() returns trigger language plpgsql as $$
begin
  if old.is_core then raise exception 'Core metric % cannot be deleted; make it optional or hide it instead', old.key; end if;
  return old;
end $$;
create trigger metric_definitions_no_core_delete before delete on metric_definitions
  for each row execute function prevent_core_metric_delete();

create table metric_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  metric_id uuid not null references metric_definitions(id),
  date date not null,
  value_num numeric,
  value_text text,
  note text,
  source text not null default 'coach_entered',
  created_at timestamptz not null default now(),
  unique (client_id, metric_id, date)
);
create index metric_entries_client_idx on metric_entries(client_id, date desc);

create table metric_definition_log (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references metric_definitions(id) on delete cascade,
  change jsonb not null,
  changed_at timestamptz not null default now()
);

-- Weekly round review marks.
create table entry_reviews (
  client_id uuid not null references clients(id) on delete cascade,
  week_start date not null,
  reviewed_at timestamptz not null default now(),
  primary key (client_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Tasks and settings
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  due_date date not null,
  kind text not null default 'manual',
  status text not null default 'open' check (status in ('open','done','snoozed')),
  snoozed_until date,
  source text not null check (source in ('rule','manual')),
  rule_key text,
  created_at timestamptz not null default now(),
  unique (client_id, rule_key, due_date)
);
create index tasks_open_idx on tasks(status, due_date);

create table settings (
  key text primary key,
  value jsonb not null
);

-- ---------------------------------------------------------------------------
-- Row-level security: trainer only, on every table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clients','intakes','clearances','referrals','exercises','foods','plans','guardrail_overrides',
    'energy_models','checkpoints','calibrations','contact_log','measurements','benchmarks','benchmark_results',
    'workout_sessions','set_logs','metric_definitions','metric_entries','metric_definition_log','entry_reviews',
    'tasks','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy trainer_all on %I for all to authenticated using (is_trainer()) with check (is_trainer())', t);
  end loop;
end $$;

alter table app_owner enable row level security;
alter table app_owner force row level security;
create policy owner_read_self on app_owner for select to authenticated using (user_id = auth.uid());

-- Explicit grants (works whether or not "Automatically expose new tables" is
-- enabled). RLS above still limits every row to the trainer.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on function is_trainer() to authenticated, service_role;

-- No anonymous access to anything.
revoke all on all tables in schema public from anon;
