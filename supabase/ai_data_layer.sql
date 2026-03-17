create table if not exists public.execution_scope_overrides (
  id bigint generated always as identity primary key,
  username text not null,
  strategy_id text not null,
  timeframe text not null,
  enabled boolean not null default true,
  action text not null default '',
  min_signal_score numeric,
  min_rr_ratio numeric,
  note text,
  source text not null default 'manual',
  recommendation_id bigint,
  experiment_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (username, strategy_id, timeframe)
);

create index if not exists execution_scope_overrides_user_idx
  on public.execution_scope_overrides (username, updated_at desc);

create table if not exists public.adaptive_actions_log (
  id bigint generated always as identity primary key,
  username text not null,
  action_type text not null,
  target_type text not null,
  target_key text not null,
  strategy_id text,
  strategy_version text,
  timeframe text,
  recommendation_id bigint,
  experiment_id bigint,
  signal_id bigint,
  execution_order_id bigint,
  source text not null default 'system',
  status text not null default 'applied',
  summary text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists adaptive_actions_log_user_created_idx
  on public.adaptive_actions_log (username, created_at desc);

create index if not exists adaptive_actions_log_scope_idx
  on public.adaptive_actions_log (username, strategy_id, timeframe, created_at desc);

create table if not exists public.signal_feature_snapshots (
  id bigint generated always as identity primary key,
  username text not null,
  signal_snapshot_id bigint not null,
  execution_order_id bigint,
  coin text not null,
  timeframe text not null,
  strategy_id text,
  strategy_version text,
  direction text,
  market_regime text,
  timeframe_bias text,
  volume_condition text,
  level_context text,
  context_signature text,
  setup_type text,
  setup_quality text,
  risk_label text,
  signal_score numeric,
  adaptive_score numeric,
  scorer_confidence numeric,
  rr_ratio numeric,
  notional_usd numeric,
  realized_pnl numeric,
  pnl_pct_on_notional numeric,
  duration_minutes numeric,
  protection_status text,
  protection_retries integer,
  execution_mode text,
  lifecycle_status text,
  decision_source text,
  decision_eligible boolean,
  entry_to_tp_pct numeric,
  entry_to_sl_pct numeric,
  feature_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signal_feature_snapshots_user_scope_idx
  on public.signal_feature_snapshots (username, strategy_id, strategy_version, timeframe, created_at desc);

create index if not exists signal_feature_snapshots_signal_idx
  on public.signal_feature_snapshots (signal_snapshot_id);

create index if not exists signal_feature_snapshots_execution_idx
  on public.signal_feature_snapshots (execution_order_id);

create or replace function public.set_ai_data_layer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_execution_scope_overrides_updated_at on public.execution_scope_overrides;
create trigger trg_execution_scope_overrides_updated_at
before update on public.execution_scope_overrides
for each row
execute function public.set_ai_data_layer_updated_at();
