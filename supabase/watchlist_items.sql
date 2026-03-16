create table if not exists public.watchlist_lists (
  id bigint generated always as identity primary key,
  username text not null,
  list_name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists watchlist_lists_username_name_uidx
  on public.watchlist_lists (username, list_name);

create index if not exists watchlist_lists_username_created_at_idx
  on public.watchlist_lists (username, created_at asc);

alter table public.watchlist_items
  add column if not exists list_name text not null default 'Principal';

drop index if exists watchlist_items_username_coin_uidx;

create unique index if not exists watchlist_items_username_list_coin_uidx
  on public.watchlist_items (username, list_name, coin);

create index if not exists watchlist_items_username_list_created_at_idx
  on public.watchlist_items (username, list_name, created_at asc);

insert into public.watchlist_lists (username, list_name, is_active)
select distinct username, 'Principal', true
from public.watchlist_items
on conflict (username, list_name) do nothing;
