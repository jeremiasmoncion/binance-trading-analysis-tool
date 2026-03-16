create table if not exists public.strategy_registry (
  id bigint generated always as identity primary key,
  strategy_id text not null unique,
  label text not null,
  description text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_versions (
  id bigint generated always as identity primary key,
  strategy_id text not null,
  version text not null,
  label text not null,
  parameters jsonb not null default '{}'::jsonb,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (strategy_id, version)
);

create table if not exists public.strategy_experiments (
  id bigint generated always as identity primary key,
  experiment_key text not null unique,
  base_strategy_id text not null,
  candidate_strategy_id text not null,
  candidate_version text not null,
  market_scope text,
  timeframe_scope text,
  status text not null default 'draft',
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_recommendations (
  id bigint generated always as identity primary key,
  recommendation_key text not null unique,
  strategy_id text not null,
  strategy_version text not null,
  parameter_key text not null,
  title text not null,
  summary text,
  current_value numeric(18,8),
  suggested_value numeric(18,8),
  confidence numeric(6,4) not null default 0,
  status text not null default 'draft',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_strategy_engine_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_strategy_registry_updated_at on public.strategy_registry;
create trigger trg_strategy_registry_updated_at
before update on public.strategy_registry
for each row
execute function public.set_strategy_engine_updated_at();

drop trigger if exists trg_strategy_versions_updated_at on public.strategy_versions;
create trigger trg_strategy_versions_updated_at
before update on public.strategy_versions
for each row
execute function public.set_strategy_engine_updated_at();

drop trigger if exists trg_strategy_experiments_updated_at on public.strategy_experiments;
create trigger trg_strategy_experiments_updated_at
before update on public.strategy_experiments
for each row
execute function public.set_strategy_engine_updated_at();

drop trigger if exists trg_strategy_recommendations_updated_at on public.strategy_recommendations;
create trigger trg_strategy_recommendations_updated_at
before update on public.strategy_recommendations
for each row
execute function public.set_strategy_engine_updated_at();

insert into public.strategy_registry (strategy_id, label, description, category)
values
  ('trend-alignment', 'Trend Alignment', 'Estrategia base de tendencia, momentum y alineación de marcos.', 'trend'),
  ('breakout', 'Breakout', 'Estrategia de ruptura con confirmación de volumen y contexto mayor.', 'breakout')
on conflict (strategy_id) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  is_active = true;

insert into public.strategy_versions (strategy_id, version, label, parameters, notes, status)
values
  (
    'trend-alignment',
    'v1',
    'Trend Alignment v1',
    '{"trendWeight":20,"oversoldBoost":15,"overboughtPenalty":15,"buyThreshold":65,"sellThreshold":35}'::jsonb,
    'Versión inicial basada en tendencia, RSI y alineación.',
    'active'
  ),
  (
    'trend-alignment',
    'v2',
    'Trend Alignment v2',
    '{"trendWeight":24,"oversoldBoost":10,"overboughtPenalty":10,"higherFrameBonus":12,"mixedFramePenalty":8,"buyThreshold":69,"sellThreshold":31}'::jsonb,
    'Variante más estricta que prioriza alineación de marcos altos y penaliza contextos mixtos.',
    'experimental'
  ),
  (
    'breakout',
    'v1',
    'Breakout v1',
    '{"lookbackCandles":20,"breakoutBufferPct":0.1,"volumeThreshold":1.15,"buyThreshold":68,"sellThreshold":32}'::jsonb,
    'Versión inicial basada en ruptura de rango y volumen.',
    'active'
  )
on conflict (strategy_id, version) do update
set
  label = excluded.label,
  parameters = excluded.parameters,
  notes = excluded.notes,
  status = excluded.status;
