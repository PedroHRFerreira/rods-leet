-- Authoritative, service-only economy. Apply after the public beta migrations.
begin;
alter table public.profiles
  add column coins integer not null default 0 check(coins>=0),
  add column avatar_id text,
  add column name_color_id text,
  add column theme_id text;
create table private.shop_items(
  id text primary key, ordinal integer not null unique, name text not null, description text not null,
  kind text not null check(kind in ('hint','avatar','name_color','theme')),
  price integer not null check(price>=0), min_level integer not null check(min_level>=0), value text not null
);
insert into private.shop_items(id,ordinal,name,description,kind,price,min_level,value) values
 ('hint-extra',0,'Dica extra','Uma dica adicional. O uso mantém a redução de XP do desafio.','hint',30,0,'1'),
 ('avatar-robot',1,'Robô explorador','Um companheiro para suas descobertas.','avatar',100,0,'🤖'),
 ('avatar-fox',2,'Raposa curiosa','Curiosidade em cada desafio.','avatar',150,2,'🦊'),
 ('avatar-scholar',3,'Coruja sábia','Presente ao alcançar o nível 5.','avatar',250,5,'🦉'),
 ('avatar-flame',4,'Chama constante','Presente por uma sequência de 30 dias.','avatar',300,5,'🔥'),
 ('name-cyan',5,'Nome ciano','Dê uma nova cor ao seu nome.','name_color',100,0,'#22d3ee'),
 ('name-violet',6,'Nome violeta','Uma cor exclusiva a partir do nível 3.','name_color',150,3,'#c4b5fd'),
 ('theme-ocean',7,'Oceano','Tons profundos de azul e ciano.','theme',200,2,'ocean'),
 ('theme-sunset',8,'Pôr do sol','Tons quentes para acompanhar seus estudos.','theme',250,5,'sunset');
create table public.coin_ledger(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null, amount integer not null, created_at timestamptz not null default now(),
  unique(user_id,source)
);
create table public.inventory(
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references private.shop_items(id),
  acquired_at timestamptz not null default now(), primary key(user_id,item_id)
);
alter table public.coin_ledger enable row level security;
alter table public.inventory enable row level security;
revoke all on public.coin_ledger,public.inventory from public,anon,authenticated;
grant all on public.coin_ledger,public.inventory to service_role;
grant all on private.shop_items to service_role;

create function private.economy_level(p_xp integer) returns integer
language sql immutable set search_path='' as $$
 select floor((sqrt(1+8*greatest(0,p_xp)::numeric/150)-1)/2)::integer;
$$;
create function private.credit_coins(p_user uuid,p_source text,p_amount integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user for update;
 insert into public.coin_ledger(user_id,source,amount) values(p_user,p_source,p_amount) on conflict do nothing;
 if not found then return false; end if;
 update public.profiles set coins=coins+p_amount where id=p_user;
 return true;
end $$;
-- Historical completions are a zero-coin baseline, never a retroactive giveaway.
insert into public.coin_ledger(user_id,source,amount)
 select distinct user_id,'completion:'||challenge_id,0 from public.completions;
insert into public.coin_ledger(user_id,source,amount)
 select p.id,'level:'||l,0 from public.profiles p
 cross join lateral generate_series(1,private.economy_level(p.xp)) l;

create function private.reward_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare d date:=(new.created_at at time zone 'UTC')::date; cursor_day date; streak integer:=0; source text;
begin
 if not private.credit_coins(new.user_id,'completion:'||new.challenge_id,10) then return new; end if;
 cursor_day:=d;
 while exists(select 1 from public.completions where user_id=new.user_id and (created_at at time zone 'UTC')::date=cursor_day) loop
  streak:=streak+1; cursor_day:=cursor_day-1;
 end loop;
 source:='streak:'||(cursor_day+1)::text||':';
 if streak=7 then perform private.credit_coins(new.user_id,source||'7',50); end if;
 if streak=30 then
  perform private.credit_coins(new.user_id,source||'30',200);
  insert into public.inventory(user_id,item_id) values(new.user_id,'avatar-flame') on conflict do nothing;
 end if;
 return new;
end $$;
create trigger economy_completion after insert on public.completions for each row execute function private.reward_completion();

create function private.reward_level() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_level integer:=private.economy_level(old.xp); after_level integer:=private.economy_level(new.xp); l integer;
begin
 if after_level>before_level then
  for l in before_level+1..after_level loop
   perform private.credit_coins(new.id,'level:'||l,25);
  end loop;
  if before_level<5 and after_level>=5 then
   insert into public.inventory(user_id,item_id) values(new.id,'avatar-scholar') on conflict do nothing;
  end if;
 end if;
 return new;
end $$;
create trigger economy_level after update of xp on public.profiles for each row execute function private.reward_level();

create function public.shop_state(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; item private.shop_items; week bigint; starts timestamptz;
begin
 select * into p from public.profiles where id=p_user;
 if not found then raise exception 'profile_not_found'; end if;
 week:=floor(extract(epoch from (now()-timestamptz '1970-01-05 00:00:00+00'))/604800)::bigint;
 starts:=timestamptz '1970-01-05 00:00:00+00'+week*interval '7 days';
 select * into item from private.shop_items where kind<>'hint' order by ordinal offset ((week%8+8)%8) limit 1;
 return jsonb_build_object(
  'coins',p.coins,
  'items',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'kind',kind,'price',price,'minLevel',min_level,'value',value) order by ordinal) from private.shop_items),
  'ownedItemIds',coalesce((select jsonb_agg(item_id order by item_id) from public.inventory where user_id=p_user),'[]'::jsonb),
  'equipped',jsonb_build_object('avatarId',p.avatar_id,'nameColorId',p.name_color_id,'themeId',p.theme_id),
  'offer',jsonb_build_object('itemId',item.id,'price',greatest(100,floor(item.price*0.8)::integer),'startsAt',starts,'endsAt',starts+interval '7 days')
 );
end $$;
revoke all on function public.shop_state(uuid) from public,anon,authenticated;
grant execute on function public.shop_state(uuid) to service_role;

create function public.shop_purchase(p_user uuid,p_item text,p_key text,p_expected_price integer default null) returns void
language plpgsql security definer set search_path='' as $$
declare item private.shop_items; profile public.profiles; charged integer; previous jsonb; snapshot jsonb;
begin
 select * into profile from public.profiles where id=p_user for update;
 if not found or not exists(select 1 from auth.users where id=p_user and coalesce(is_anonymous,false)=false) then raise exception 'account_required'; end if;
 select response into previous from private.idempotency where user_id=p_user and operation='shop:purchase' and key=p_key;
 if found then
  if previous->>'itemId'<>p_item then raise exception 'idempotency_conflict'; end if;
  return;
 end if;
 select * into item from private.shop_items where id=p_item;
 if not found then raise exception 'item_not_found'; end if;
 if item.kind<>'hint' and exists(select 1 from public.inventory where user_id=p_user and item_id=p_item) then
  insert into private.idempotency values(p_user,'shop:purchase',p_key,jsonb_build_object('itemId',p_item));
  return;
 end if;
 if private.economy_level(profile.xp)<item.min_level then raise exception 'item_locked'; end if;
 if item.price=0 then raise exception 'milestone_required'; end if;
 snapshot:=public.shop_state(p_user);
 charged:=case when snapshot->'offer'->>'itemId'=p_item then (snapshot->'offer'->>'price')::integer else item.price end;
 if p_expected_price is null or charged<>p_expected_price then raise exception 'price_changed'; end if;
 if profile.coins<charged then raise exception 'insufficient_coins'; end if;
 perform private.credit_coins(p_user,'purchase:'||p_key,-charged);
 if item.kind='hint' then
  update public.profiles set hint_balance=hint_balance+1 where id=p_user;
 else
  insert into public.inventory(user_id,item_id) values(p_user,p_item);
 end if;
 insert into private.idempotency values(p_user,'shop:purchase',p_key,jsonb_build_object('itemId',p_item));
end $$;

create function public.shop_equip(p_user uuid,p_item text,p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare item private.shop_items; previous jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found or not exists(select 1 from auth.users where id=p_user and coalesce(is_anonymous,false)=false) then raise exception 'account_required'; end if;
 select response into previous from private.idempotency where user_id=p_user and operation='shop:equip' and key=p_key;
 if found then
  if previous->>'itemId'<>p_item then raise exception 'idempotency_conflict'; end if;
  return;
 end if;
 if p_item in ('avatar-default','name-default','theme-default') then
  update public.profiles set
   avatar_id=case when p_item='avatar-default' then null else avatar_id end,
   name_color_id=case when p_item='name-default' then null else name_color_id end,
   theme_id=case when p_item='theme-default' then null else theme_id end where id=p_user;
  insert into private.idempotency values(p_user,'shop:equip',p_key,jsonb_build_object('itemId',p_item));
  return;
 end if;
 select * into item from private.shop_items where id=p_item;
 if not found then raise exception 'item_not_found'; end if;
 if item.kind='hint' then raise exception 'item_not_equippable'; end if;
 if not exists(select 1 from public.inventory where user_id=p_user and item_id=p_item) then raise exception 'item_not_owned'; end if;
 update public.profiles set
  avatar_id=case when item.kind='avatar' then p_item else avatar_id end,
  name_color_id=case when item.kind='name_color' then p_item else name_color_id end,
  theme_id=case when item.kind='theme' then p_item else theme_id end where id=p_user;
 insert into private.idempotency values(p_user,'shop:equip',p_key,jsonb_build_object('itemId',p_item));
end $$;
revoke all on function private.credit_coins(uuid,text,integer), private.reward_completion(), private.reward_level(), private.economy_level(integer),public.shop_purchase(uuid,text,text,integer),public.shop_equip(uuid,text,text) from public,anon,authenticated;
grant execute on function public.shop_purchase(uuid,text,text,integer),public.shop_equip(uuid,text,text) to service_role;
-- Upgrading the anonymous identity also replaces its generated explorer name.
create or replace function public.admit_user(p_user uuid,p_email text,p_name text,p_github_login text default null) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'authentication_required'; end if;
 select * into result from public.profiles where id=p_user;
 if found then
  if p_email<>'' and p_name<>'' and result.display_name=('Explorador '||left(p_user::text,6)) then
   update public.profiles set display_name=left(p_name,80) where id=p_user returning * into result;
  end if;
  return result;
 end if;
 insert into public.profiles(id,display_name) values(p_user,left(coalesce(nullif(p_name,''),'Jogador'),80)) on conflict(id) do nothing;
 select * into result from public.profiles where id=p_user;
 return result;
end $$;
commit;
