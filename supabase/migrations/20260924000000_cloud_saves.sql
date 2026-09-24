-- Cloud saves for 青禾小镇: one row per signed-in player, readable and writable only by that player.
-- Run once in the Supabase dashboard (SQL Editor). See docs/CLOUD_SETUP.md.

create table if not exists public.saves (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  version int not null check (version between 1 and 10000),
  updated_at timestamptz not null default now(),
  -- One row per account, and this bounds how much that row may hold.
  constraint saves_size check (octet_length(data::text) <= 1000000)
);

-- Row Level Security is the lock: the anon key in the page is public by design.
alter table public.saves enable row level security;

drop policy if exists "read own save" on public.saves;
drop policy if exists "insert own save" on public.saves;
drop policy if exists "update own save" on public.saves;
drop policy if exists "delete own save" on public.saves;
create policy "read own save" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own save" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own save" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own save" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);

-- Start from nothing (Supabase's default privileges would give authenticated ALL, TRUNCATE included),
-- then allow only what the game uses. Signed-out visitors get nothing, even before RLS is consulted.
revoke all on public.saves from anon, authenticated;
grant select, insert, update, delete on public.saves to authenticated;

-- The last write per player, kept apart from the save so that deleting and re-creating the row does
-- not reset it. Nobody but the trigger below can read or write it.
create table if not exists public.save_writes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  at timestamptz not null
);
alter table public.save_writes enable row level security;
revoke all on public.save_writes from anon, authenticated;

-- The server owns updated_at (the client's optimistic-concurrency token), and any write (insert or
-- update) less than 5 seconds after the player's previous one is rejected, so no account can hammer
-- the database. security definer lets it record the write in save_writes, which players cannot touch.
create or replace function public.saves_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  insert into public.save_writes as w values (new.user_id, now())
    on conflict (user_id) do update set at = now() where w.at <= now() - interval '5 seconds';
  if not found then raise exception 'too many saves' using errcode = 'P0001'; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.saves_stamp() from public, anon, authenticated;

drop trigger if exists saves_stamp on public.saves;
create trigger saves_stamp before insert or update on public.saves
  for each row execute function public.saves_stamp();
