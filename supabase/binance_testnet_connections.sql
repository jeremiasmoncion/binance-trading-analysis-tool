create table if not exists public.binance_testnet_connections (
  username text primary key references public.app_users(username) on delete cascade,
  api_key_encrypted text not null,
  api_secret_encrypted text not null,
  account_alias text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.binance_testnet_connections
add column if not exists account_alias text;

drop trigger if exists trg_binance_testnet_connections_updated_at on public.binance_testnet_connections;
create trigger trg_binance_testnet_connections_updated_at
before update on public.binance_testnet_connections
for each row
execute function public.set_updated_at();

alter table public.binance_testnet_connections enable row level security;
