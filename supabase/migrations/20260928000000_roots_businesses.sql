-- Additive Roots ledger. Run after cloud_saves; rates/time are owned by these functions.
create table if not exists public.roots_businesses (
 user_id uuid not null references auth.users(id) on delete cascade,
 business text not null check(business='fruit-stand'),
 automatic boolean not null default false,
 settled_at timestamptz not null default clock_timestamp(),
 remainder numeric not null default 0 check(remainder>=0 and remainder<1),
 primary key(user_id,business)
);
create table if not exists public.roots_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request uuid not null, business text not null, action text not null, amount integer not null, save_revision timestamptz not null,
 primary key(user_id,request)
);
alter table public.roots_businesses enable row level security;
alter table public.roots_receipts enable row level security;
revoke all on public.roots_businesses,public.roots_receipts from public,anon,authenticated;
grant select on public.roots_businesses to authenticated;
create policy "read own roots businesses" on public.roots_businesses for select to authenticated using(user_id=(select auth.uid()));

-- Invoker context distinguishes ordinary client writes from the SECURITY DEFINER RPC.
create or replace function public.roots_save_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   -- Recreating a save cannot recreate its business ledger or trust imported snapshots.
   new.data:=jsonb_set(new.data-'businessRevision','{businesses}',public.roots_business_status()->'businesses');
  elsif (new.data->'businesses') is distinct from (old.data->'businesses') or (new.data->'businessRevision') is distinct from (old.data->'businessRevision') then
   raise exception 'Business fields are server-owned';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.roots_save_guard() from public,anon,authenticated;
create trigger roots_save_guard before insert or update on public.saves for each row execute function public.roots_save_guard();

create or replace function public.roots_business_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select coalesce(jsonb_object_agg(business,jsonb_build_object('active',true,'automatic',automatic,'settledAt',settled_at)),'{}'::jsonb) into result from public.roots_businesses where user_id=auth.uid();
 return jsonb_build_object('serverTime',clock_timestamp(),'businesses',result);
end $$;

create or replace function public.roots_business_command(p_business text,p_action text,p_request uuid,p_seen timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); saved public.saves%rowtype; b public.roots_businesses%rowtype; receipt public.roots_receipts%rowtype;
 at_time timestamptz:=clock_timestamp(); earnings numeric:=0; paid integer:=0; cost integer:=0; cash integer; snapshot jsonb; skill text; required text[]; found_count integer;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_business is distinct from 'fruit-stand' or p_action is null or p_action not in ('activate','collect','automate') or p_request is null then raise exception 'Invalid business command';end if;
 -- Save row first for a consistent lock order across simultaneous business operations.
 select * into saved from public.saves where user_id=uid for update;
 if not found then return jsonb_build_object('status','save-required');end if;
 select * into receipt from public.roots_receipts where user_id=uid and request=p_request;
 if found then
  if receipt.business<>p_business or receipt.action<>p_action then raise exception 'Request ID reused for a different action';end if;
  if receipt.save_revision is distinct from saved.updated_at then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','settled','amount',receipt.amount,'profile',saved.data,'seen',saved.updated_at,'duplicate',true);
 end if;
 if p_seen is distinct from saved.updated_at then return jsonb_build_object('status','conflict');end if;
 cash:=(saved.data->>'wallet')::integer;
 select * into b from public.roots_businesses where user_id=uid and business=p_business for update;
 if not found then
  if p_action<>'activate' then return jsonb_build_object('status','inactive');end if;
  if saved.data#>>'{roots,met}' is distinct from 'true' or not coalesce(saved.data#>'{roots,photos}' ? 'roots-fruit',false) then return jsonb_build_object('status','requirements');end if;
  foreach skill in array array['roots-greeting','roots-fruit-request','roots-quantity'] loop
   required:=case skill when 'roots-greeting' then array['greet-a','greet-b','greet-c'] when 'roots-fruit-request' then array['fruit-a','fruit-b','fruit-c'] else array['quantity-a','quantity-b','quantity-c'] end;
   select count(distinct value) into found_count from jsonb_array_elements_text(coalesce(saved.data#>array['roots','mastery',skill],'[]'::jsonb)) where value=any(required);
   if found_count<2 then return jsonb_build_object('status','requirements');end if;
  end loop;
  cost:=20;if cash<cost then return jsonb_build_object('status','funds');end if;
  insert into public.roots_businesses(user_id,business,settled_at) values(uid,p_business,at_time) returning * into b;
 else
  if p_action='activate' then return jsonb_build_object('status','already-active');end if;
  if p_action='automate' then
   if b.automatic then return jsonb_build_object('status','already-automatic');end if;
   if saved.data#>>'{roots,bankMastered}' is distinct from 'true' then return jsonb_build_object('status','requirements');end if;
   cost:=90;if cash<cost then return jsonb_build_object('status','funds');end if;
  end if;
  earnings:=least(greatest(extract(epoch from(at_time-b.settled_at)),0),case when b.automatic then 604800 else 259200 end)*30/86400+b.remainder;
  paid:=floor(earnings);
  update public.roots_businesses set settled_at=at_time,remainder=earnings-paid,automatic=automatic or p_action='automate' where user_id=uid and business=p_business returning * into b;
 end if;
 snapshot:=jsonb_build_object(p_business,jsonb_build_object('active',true,'automatic',b.automatic,'settledAt',b.settled_at));
 -- Existing saves_stamp enforces the five-second throttle. A rejection rolls back the entire RPC.
 update public.saves set data=jsonb_set(jsonb_set(jsonb_set(saved.data,'{wallet}',to_jsonb(cash+paid-cost)),'{businesses}',snapshot),'{businessRevision}',to_jsonb(p_request::text)) where user_id=uid returning * into saved;
 insert into public.roots_receipts values(uid,p_request,p_business,p_action,paid,saved.updated_at);
 return jsonb_build_object('status','settled','amount',paid,'profile',saved.data,'seen',saved.updated_at);
end $$;
revoke all on function public.roots_business_status(),public.roots_business_command(text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.roots_business_status(),public.roots_business_command(text,text,uuid,timestamptz) to authenticated;
