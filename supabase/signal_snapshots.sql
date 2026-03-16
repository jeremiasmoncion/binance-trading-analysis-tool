create table if not exists public.signal_snapshots (
  id bigint generated always as identity primary key,
  username text not null,
  coin text not null,
  timeframe text not null,
  strategy_name text,
  strategy_version text,
  strategy_label text,
  signal_label text not null,
  signal_score numeric(10,2) not null default 0,
  trend text,
  setup_type text,
  setup_quality text,
  risk_label text,
  support numeric(18,8),
  resistance numeric(18,8),
  entry_price numeric(18,8),
  tp_price numeric(18,8),
  tp2_price numeric(18,8),
  sl_price numeric(18,8),
  rr_ratio numeric(10,2),
  confirmations_count integer not null default 0,
  warnings_count integer not null default 0,
  outcome_status text not null default 'pending',
  outcome_pnl numeric(18,8) not null default 0,
  note text,
  signal_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.signal_snapshots add column if not exists strategy_name text;
alter table public.signal_snapshots add column if not exists strategy_version text;
alter table public.signal_snapshots add column if not exists strategy_label text;

create index if not exists signal_snapshots_username_created_at_idx
  on public.signal_snapshots (username, created_at desc);

create or replace function public.set_signal_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_signal_snapshots_updated_at on public.signal_snapshots;

create trigger trg_signal_snapshots_updated_at
before update on public.signal_snapshots
for each row
execute function public.set_signal_snapshots_updated_at();
