create or replace function public.set_execution_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.execution_profiles (
  username text primary key,
  enabled boolean not null default true,
  auto_execute_enabled boolean not null default false,
  risk_per_trade_pct numeric not null default 5,
  max_open_positions integer not null default 2,
  max_position_usd numeric not null default 150,
  max_daily_loss_pct numeric not null default 3,
  min_signal_score numeric not null default 60,
  min_rr_ratio numeric not null default 1.5,
  allowed_strategies text[] not null default array['trend-alignment','breakout'],
  allowed_timeframes text[] not null default array['15m','1h','4h'],
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.execution_orders (
  id bigserial primary key,
  username text not null,
  signal_id bigint,
  coin text not null,
  timeframe text,
  strategy_name text,
  strategy_version text,
  side text,
  quantity numeric,
  notional_usd numeric,
  current_price numeric,
  mode text not null default 'preview',
  status text not null default 'preview',
  order_id bigint,
  client_order_id text,
  notes text,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.execution_profiles
  add column if not exists enabled boolean not null default true,
  add column if not exists auto_execute_enabled boolean not null default false,
  add column if not exists risk_per_trade_pct numeric not null default 5,
  add column if not exists max_open_positions integer not null default 2,
  add column if not exists max_position_usd numeric not null default 150,
  add column if not exists max_daily_loss_pct numeric not null default 3,
  add column if not exists min_signal_score numeric not null default 60,
  add column if not exists min_rr_ratio numeric not null default 1.5,
  add column if not exists allowed_strategies text[] not null default array['trend-alignment','breakout'],
  add column if not exists allowed_timeframes text[] not null default array['15m','1h','4h'],
  add column if not exists note text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.execution_orders
  add column if not exists username text not null default '',
  add column if not exists signal_id bigint,
  add column if not exists coin text not null default '',
  add column if not exists timeframe text,
  add column if not exists strategy_name text,
  add column if not exists strategy_version text,
  add column if not exists side text,
  add column if not exists quantity numeric,
  add column if not exists notional_usd numeric,
  add column if not exists current_price numeric,
  add column if not exists mode text not null default 'preview',
  add column if not exists status text not null default 'preview',
  add column if not exists order_id bigint,
  add column if not exists client_order_id text,
  add column if not exists notes text,
  add column if not exists response_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

drop trigger if exists trg_execution_profiles_updated_at on public.execution_profiles;
create trigger trg_execution_profiles_updated_at
before update on public.execution_profiles
for each row execute function public.set_execution_profile_updated_at();

create index if not exists idx_execution_orders_username_created_at
  on public.execution_orders (username, created_at desc);
