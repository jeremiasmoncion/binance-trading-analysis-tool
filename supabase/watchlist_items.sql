create table if not exists public.watchlist_items (
  id bigint generated always as identity primary key,
  username text not null,
  coin text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists watchlist_items_username_coin_uidx
  on public.watchlist_items (username, coin);

create index if not exists watchlist_items_username_created_at_idx
  on public.watchlist_items (username, created_at asc);
