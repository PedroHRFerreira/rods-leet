-- Additive study rewards and cosmetic inventory. No historical mission/podium credit.
begin;
alter table public.profiles add column frame_id text, add column title_id text;
alter table private.shop_items drop constraint shop_items_kind_check;
alter table private.shop_items add constraint shop_items_kind_check check(kind in ('hint','avatar','name_color','theme','frame','title'));
alter table private.shop_items
 add column rarity text not null default 'common' check(rarity in ('common','rare','epic','legendary')),
 add column acquisition text not null default 'purchase' check(acquisition in ('purchase','milestone','collection','ranking')),
 add column collection_id text,
 add column hint_count integer check(hint_count>0);
update private.shop_items set hint_count=1 where kind='hint';
update private.shop_items set acquisition='milestone',price=0,rarity='epic' where id in ('avatar-scholar','avatar-flame');
create table private.shop_collections (
 id text primary key, name text not null, description text not null,
 item_ids text[] not null, reward_item_id text not null references private.shop_items(id)
);
alter table private.settings add column shop_rewards_started_at timestamptz not null default now();
create table private.study_completions (
 user_id uuid not null references public.profiles(id) on delete cascade,
 challenge_id text not null, created_at timestamptz not null,
 primary key(user_id,challenge_id)
);
create index study_completions_period on private.study_completions(user_id,created_at);
create table private.weekly_results (
 starts_at timestamptz primary key, ends_at timestamptz not null unique,
 winners jsonb not null, closed_at timestamptz not null default now(),
 check(ends_at=starts_at+interval '7 days')
);
revoke all on private.shop_collections,private.study_completions,private.weekly_results from public,anon,authenticated;
grant all on private.shop_collections,private.study_completions,private.weekly_results to service_role;

insert into private.shop_items(id,ordinal,name,description,kind,price,min_level,value,rarity,acquisition,collection_id,hint_count) values
 ('hint-extra',0,'Dica extra','1 dica adicional. O uso mantém a redução de XP do desafio.','hint',30,0,'1','common','purchase',null,1),
 ('avatar-robot',1,'Robô explorador','Um personagem para acompanhar suas descobertas e desafios.','avatar',100,0,'🤖','common','purchase',null,null),
 ('avatar-fox',2,'Raposa curiosa','Um personagem para acompanhar suas descobertas e desafios.','avatar',150,2,'🦊','common','purchase',null,null),
 ('avatar-scholar',3,'Coruja sábia','Presente ao alcançar o nível 5.','avatar',0,5,'🦉','epic','milestone',null,null),
 ('avatar-flame',4,'Chama constante','Presente por uma sequência de 30 dias.','avatar',0,0,'🔥','epic','milestone',null,null),
 ('name-cyan',5,'Nome ciano','Uma nova cor para seu nome no perfil e no ranking.','name_color',100,0,'#22d3ee','common','purchase',null,null),
 ('name-violet',6,'Nome violeta','Uma nova cor para seu nome no perfil e no ranking.','name_color',150,3,'#c4b5fd','rare','purchase',null,null),
 ('theme-ocean',7,'Oceano','Uma paleta completa para personalizar seu espaço de estudo.','theme',200,2,'ocean','rare','purchase',null,null),
 ('theme-sunset',8,'Pôr do sol','Uma paleta completa para personalizar seu espaço de estudo.','theme',250,5,'sunset','rare','purchase',null,null),
 ('hint-pack3',9,'Pacote de 3 dicas','3 dicas adicionais com desconto. O uso mantém a redução de XP do desafio.','hint',75,0,'3','common','purchase',null,3),
 ('hint-pack10',10,'Pacote de 10 dicas','10 dicas adicionais com desconto. O uso mantém a redução de XP do desafio.','hint',220,0,'10','rare','purchase',null,10),
 ('avatar-robot-neon',11,'Robô Neon','Um personagem para acompanhar suas descobertas e desafios.','avatar',300,2,'robot-neon','rare','purchase','neon',null),
 ('name-neon-lime',12,'Nome lima Neon','Uma nova cor para seu nome no perfil e no ranking.','name_color',200,0,'#bef264','common','purchase','neon',null),
 ('theme-neon',13,'Cidade Neon','Uma paleta completa para personalizar seu espaço de estudo.','theme',450,3,'neon','epic','purchase','neon',null),
 ('frame-neon',14,'Circuito Neon','Uma moldura para destacar seu personagem no perfil e no ranking.','frame',250,2,'neon','rare','purchase','neon',null),
 ('title-neon',15,'Pulso Neon','Presente exclusivo ao completar todos os itens desta coleção.','title',0,0,'Pulso Neon','epic','collection','neon',null),
 ('avatar-astronaut',16,'Astronauta','Um personagem para acompanhar suas descobertas e desafios.','avatar',300,2,'astronaut','rare','purchase','astral',null),
 ('name-rose',17,'Nome rosa estelar','Uma nova cor para seu nome no perfil e no ranking.','name_color',200,0,'#f9a8d4','common','purchase','astral',null),
 ('theme-cosmos',18,'Cosmos','Uma paleta completa para personalizar seu espaço de estudo.','theme',450,3,'cosmos','epic','purchase','astral',null),
 ('frame-orbit',19,'Órbita estelar','Uma moldura para destacar seu personagem no perfil e no ranking.','frame',250,2,'orbit','rare','purchase','astral',null),
 ('title-astral',20,'Explorador Astral','Presente exclusivo ao completar todos os itens desta coleção.','title',0,0,'Explorador Astral','epic','collection','astral',null),
 ('avatar-dragon',21,'Dragão do Bosque','Um personagem para acompanhar suas descobertas e desafios.','avatar',350,2,'dragon','rare','purchase','forest',null),
 ('name-emerald',22,'Nome esmeralda','Uma nova cor para seu nome no perfil e no ranking.','name_color',200,0,'#6ee7b7','common','purchase','forest',null),
 ('theme-forest',23,'Bosque','Uma paleta completa para personalizar seu espaço de estudo.','theme',400,3,'forest','epic','purchase','forest',null),
 ('frame-vine',24,'Ramos do Bosque','Uma moldura para destacar seu personagem no perfil e no ranking.','frame',250,2,'vine','rare','purchase','forest',null),
 ('title-forest',25,'Guardião do Bosque','Presente exclusivo ao completar todos os itens desta coleção.','title',0,0,'Guardião do Bosque','epic','collection','forest',null),
 ('avatar-ninja',26,'Ninja do código','Um personagem para acompanhar suas descobertas e desafios.','avatar',350,3,'ninja','rare','purchase',null,null),
 ('frame-pixel',27,'Pixels clássicos','Uma moldura para destacar seu personagem no perfil e no ranking.','frame',150,0,'pixel','common','purchase',null,null),
 ('title-curious',28,'Pessoa curiosa','Um título para acompanhar seu nome e suas conquistas.','title',100,0,'Pessoa curiosa','common','purchase',null,null),
 ('title-persistent',29,'Sempre aprendendo','Um título para acompanhar seu nome e suas conquistas.','title',150,1,'Sempre aprendendo','common','purchase',null,null),
 ('title-debugger',30,'Caça-bugs','Um título para acompanhar seu nome e suas conquistas.','title',200,2,'Caça-bugs','rare','purchase',null,null),
 ('title-algorithm',31,'Arquiteto de algoritmos','Um título para acompanhar seu nome e suas conquistas.','title',350,5,'Arquiteto de algoritmos','epic','purchase',null,null),
 ('frame-champion',32,'Campeão semanal','Premiação permanente por posição no ranking semanal; não está à venda.','frame',0,0,'champion','legendary','ranking',null,null),
 ('frame-runnerup',33,'Vice-campeão semanal','Premiação permanente por posição no ranking semanal; não está à venda.','frame',0,0,'runnerup','legendary','ranking',null,null),
 ('frame-bronze',34,'Bronze semanal','Premiação permanente por posição no ranking semanal; não está à venda.','frame',0,0,'bronze','legendary','ranking',null,null),
 ('frame-finalist4',35,'Finalista semanal IV','Premiação permanente por posição no ranking semanal; não está à venda.','frame',0,0,'finalist4','legendary','ranking',null,null),
 ('frame-finalist5',36,'Finalista semanal V','Premiação permanente por posição no ranking semanal; não está à venda.','frame',0,0,'finalist5','legendary','ranking',null,null)
on conflict(id) do update set name=excluded.name,description=excluded.description,kind=excluded.kind,price=excluded.price,min_level=excluded.min_level,value=excluded.value,rarity=excluded.rarity,acquisition=excluded.acquisition,collection_id=excluded.collection_id,hint_count=excluded.hint_count;
insert into private.shop_collections(id,name,description,item_ids,reward_item_id) values
 ('neon','Neon','Complete o conjunto Neon para ganhar um título exclusivo.',array['avatar-robot-neon','name-neon-lime','theme-neon','frame-neon'],'title-neon'),
 ('astral','Astral','Complete o conjunto Astral para ganhar um título exclusivo.',array['avatar-astronaut','name-rose','theme-cosmos','frame-orbit'],'title-astral'),
 ('forest','Bosque','Complete o conjunto Bosque para ganhar um título exclusivo.',array['avatar-dragon','name-emerald','theme-forest','frame-vine'],'title-forest');

create function private.study_week(p_at timestamptz) returns timestamptz
language sql immutable set search_path='' as $$
 select date_trunc('week',p_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;
create function private.study_day(p_at timestamptz) returns timestamptz
language sql immutable set search_path='' as $$
 select date_trunc('day',p_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;
create function private.reward_study_missions() returns trigger
language plpgsql security definer set search_path='' as $$
declare started timestamptz; day_start timestamptz; week_start timestamptz;
begin
 select shop_rewards_started_at into started from private.settings where singleton;
 if new.created_at<started or not exists(select 1 from auth.users where id=new.user_id and is_anonymous=false) then return new; end if;
 -- Only the first official completion of this challenge, across all modes.
 if exists(select 1 from public.completions where user_id=new.user_id and challenge_id=new.challenge_id and mode<>new.mode) then return new; end if;
 perform 1 from public.profiles where id=new.user_id for update;
 insert into private.study_completions(user_id,challenge_id,created_at) values(new.user_id,new.challenge_id,new.created_at) on conflict do nothing;
 if not found then return new; end if;
 day_start:=private.study_day(new.created_at); week_start:=private.study_week(new.created_at);
 if (select count(*) from private.study_completions where user_id=new.user_id and created_at>=day_start and created_at<day_start+interval '1 day')>=3 then
  perform private.credit_coins(new.user_id,'mission:daily:'||(extract(epoch from day_start)::bigint)::text,20);
 end if;
 if (select count(*) from private.study_completions where user_id=new.user_id and created_at>=week_start and created_at<week_start+interval '7 days')>=7 then
  perform private.credit_coins(new.user_id,'mission:weekly:'||(extract(epoch from week_start)::bigint)::text,75);
 end if;
 return new;
end $$;
create trigger economy_study_missions after insert on public.completions for each row execute function private.reward_study_missions();

create function private.reward_collections() returns trigger
language plpgsql security definer set search_path='' as $$
declare collection private.shop_collections;
begin
 perform 1 from public.profiles where id=new.user_id for update;
 for collection in select * from private.shop_collections where new.item_id=any(item_ids) loop
  if not exists(select 1 from unnest(collection.item_ids) required(id) where not exists(select 1 from public.inventory where user_id=new.user_id and item_id=required.id)) then
   insert into public.inventory(user_id,item_id) values(new.user_id,collection.reward_item_id) on conflict do nothing;
  end if;
 end loop;
 return new;
end $$;
create trigger economy_collection after insert on public.inventory for each row execute function private.reward_collections();

create function private.shop_offers(p_at timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
 with eligible as (
  select *,row_number() over(order by ordinal)-1 n,count(*) over() total
  from private.shop_items where acquisition='purchase' and kind<>'hint'
 ), selected as (
  select * from eligible order by mod(n-mod(floor(extract(epoch from private.study_week(p_at))/604800)::bigint,total)+total,total) limit 3
 ) select coalesce(jsonb_agg(jsonb_build_object('itemId',id,'price',greatest(1,floor(price*0.8)::integer),'startsAt',private.study_week(p_at),'endsAt',private.study_week(p_at)+interval '7 days') order by mod(n-mod(floor(extract(epoch from private.study_week(p_at))/604800)::bigint,total)+total,total)),'[]'::jsonb) from selected;
$$;
create or replace function public.shop_state(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; offers jsonb; at_time timestamptz:=now(); day_start timestamptz; week_start timestamptz; registered boolean;
begin
 select * into p from public.profiles where id=p_user;
 if not found then raise exception 'profile_not_found'; end if;
 registered:=exists(select 1 from auth.users where id=p_user and is_anonymous=false);
 day_start:=private.study_day(at_time); week_start:=private.study_week(at_time); offers:=private.shop_offers(at_time);
 return jsonb_build_object(
  'coins',p.coins,
  'items',(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'name',name,'description',description,'kind',kind,'price',price,'minLevel',min_level,'value',value,'rarity',rarity,'acquisition',acquisition,'collectionId',collection_id,'hintCount',hint_count)) order by ordinal) from private.shop_items),
  'ownedItemIds',coalesce((select jsonb_agg(item_id order by item_id) from public.inventory where user_id=p_user),'[]'::jsonb),
  'equipped',jsonb_build_object('avatarId',p.avatar_id,'nameColorId',p.name_color_id,'themeId',p.theme_id,'frameId',p.frame_id,'titleId',p.title_id),
  'offer',offers->0,'offers',offers,
  'collections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'itemIds',item_ids,'rewardItemId',reward_item_id) order by id) from private.shop_collections),'[]'::jsonb),
  'missions',jsonb_build_array(
   jsonb_build_object('id','daily','target',3,'progress',least(3,(select count(*) from private.study_completions where user_id=p_user and created_at>=day_start and created_at<day_start+interval '1 day')),'coins',20,'startsAt',day_start,'endsAt',day_start+interval '1 day','claimed',exists(select 1 from public.coin_ledger where user_id=p_user and source='mission:daily:'||(extract(epoch from day_start)::bigint)::text),'eligible',registered),
   jsonb_build_object('id','weekly','target',7,'progress',least(7,(select count(*) from private.study_completions where user_id=p_user and created_at>=week_start and created_at<week_start+interval '7 days')),'coins',75,'startsAt',week_start,'endsAt',week_start+interval '7 days','claimed',exists(select 1 from public.coin_ledger where user_id=p_user and source='mission:weekly:'||(extract(epoch from week_start)::bigint)::text),'eligible',registered)
  )
 );
end $$;
create or replace function public.shop_purchase(p_user uuid,p_item text,p_key text,p_expected_price integer default null) returns void
language plpgsql security definer set search_path='' as $$
declare item private.shop_items; profile public.profiles; charged integer; previous jsonb;
begin
 select * into profile from public.profiles where id=p_user for update;
 if not found or not exists(select 1 from auth.users where id=p_user and is_anonymous=false) then raise exception 'account_required'; end if;
 select response into previous from private.idempotency where user_id=p_user and operation='shop:purchase' and key=p_key;
 if found then
  if previous->>'itemId'<>p_item then raise exception 'idempotency_conflict'; end if;
  return;
 end if;
 select * into item from private.shop_items where id=p_item;
 if not found then raise exception 'item_not_found'; end if;
 if item.acquisition<>'purchase' then raise exception 'item_not_purchasable'; end if;
 if item.kind<>'hint' and exists(select 1 from public.inventory where user_id=p_user and item_id=p_item) then
  insert into private.idempotency values(p_user,'shop:purchase',p_key,jsonb_build_object('itemId',p_item)); return;
 end if;
 if private.economy_level(profile.xp)<item.min_level then raise exception 'item_locked'; end if;
 select (offer->>'price')::integer into charged from jsonb_array_elements(private.shop_offers(now())) offer where offer->>'itemId'=p_item;
 charged:=coalesce(charged,item.price);
 if p_expected_price is null or charged<>p_expected_price then raise exception 'price_changed'; end if;
 if profile.coins<charged then raise exception 'insufficient_coins'; end if;
 perform private.credit_coins(p_user,'purchase:'||p_key,-charged);
 if item.kind='hint' then
  update public.profiles set hint_balance=hint_balance+coalesce(item.hint_count,1) where id=p_user;
 else
  insert into public.inventory(user_id,item_id) values(p_user,p_item);
 end if;
 insert into private.idempotency values(p_user,'shop:purchase',p_key,jsonb_build_object('itemId',p_item));
end $$;
create or replace function public.shop_equip(p_user uuid,p_item text,p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare item private.shop_items; previous jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found or not exists(select 1 from auth.users where id=p_user and is_anonymous=false) then raise exception 'account_required'; end if;
 select response into previous from private.idempotency where user_id=p_user and operation='shop:equip' and key=p_key;
 if found then
  if previous->>'itemId'<>p_item then raise exception 'idempotency_conflict'; end if;
  return;
 end if;
 if p_item in ('avatar-default','name-default','theme-default','frame-default','title-default') then
  update public.profiles set
   avatar_id=case when p_item='avatar-default' then null else avatar_id end,
   name_color_id=case when p_item='name-default' then null else name_color_id end,
   theme_id=case when p_item='theme-default' then null else theme_id end,
   frame_id=case when p_item='frame-default' then null else frame_id end,
   title_id=case when p_item='title-default' then null else title_id end where id=p_user;
 else
  select * into item from private.shop_items where id=p_item;
  if not found then raise exception 'item_not_found'; end if;
  if item.kind='hint' then raise exception 'item_not_equippable'; end if;
  if not exists(select 1 from public.inventory where user_id=p_user and item_id=p_item) then raise exception 'item_not_owned'; end if;
  update public.profiles set
   avatar_id=case when item.kind='avatar' then p_item else avatar_id end,
   name_color_id=case when item.kind='name_color' then p_item else name_color_id end,
   theme_id=case when item.kind='theme' then p_item else theme_id end,
   frame_id=case when item.kind='frame' then p_item else frame_id end,
   title_id=case when item.kind='title' then p_item else title_id end where id=p_user;
 end if;
 insert into private.idempotency values(p_user,'shop:equip',p_key,jsonb_build_object('itemId',p_item));
end $$;

-- XP is the net sum of official events, never the all-time profile balance.
-- reachedAt is the earliest event where the final period score was attained.
create function private.weekly_entries(p_start timestamptz,p_end timestamptz,p_user uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with scores as (
  select e.user_id,sum(e.amount)::integer xp from public.xp_events e,private.settings settings
  where settings.singleton and e.created_at>=p_start and e.created_at<p_end group by e.user_id
 ), activity as (
  select c.user_id,count(distinct c.challenge_id)::integer completed from public.completions c,private.settings settings
  where settings.singleton and c.created_at>=p_start and c.created_at<p_end group by c.user_id
 ), running as (
  select e.user_id,e.created_at,sum(e.amount) over(partition by e.user_id order by e.created_at,e.id rows unbounded preceding) running_xp
  from public.xp_events e,private.settings settings where settings.singleton and e.created_at>=p_start and e.created_at<p_end
 ), reached as (
  select r.user_id,min(r.created_at) reached_at from running r join scores s on s.user_id=r.user_id where r.running_xp=s.xp group by r.user_id
 ), entries as (
  select p.id,p.display_name,p.avatar_id,p.name_color_id,p.theme_id,p.frame_id,p.title_id,coalesce(s.xp,0) xp,coalesce(a.completed,0) completed,coalesce(r.reached_at,p.created_at) reached_at,
   coalesce(s.xp,0)>0 and coalesce(a.completed,0)>=3 eligible
  from public.profiles p join auth.users u on u.id=p.id and u.is_anonymous=false
  left join scores s on s.user_id=p.id left join activity a on a.user_id=p.id left join reached r on r.user_id=p.id
 ) select coalesce(jsonb_agg(jsonb_build_object('userId',id,'displayName',display_name,'avatarId',avatar_id,'nameColorId',name_color_id,'themeId',theme_id,'frameId',frame_id,'titleId',title_id,'xp',xp,'completedCount',completed,'reachedAt',reached_at,'isCurrentUser',id=p_user,'weeklyXp',xp,'weeklyCompletedCount',completed,'eligible',eligible) order by xp desc,completed desc,reached_at,id),'[]'::jsonb) from entries where eligible or id=p_user;
$$;
create function private.close_study_week(p_start timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare started timestamptz; winners jsonb; ranked jsonb; winner jsonb; position integer:=0; prize integer; frame text; person uuid;
begin
 select shop_rewards_started_at into started from private.settings where singleton;
 if p_start<>private.study_week(p_start) then raise exception 'invalid_week'; end if;
 if p_start<private.study_week(started) then return false; end if;
 if p_start+interval '7 days'>now() then return false; end if;
 perform pg_advisory_xact_lock(731921,(extract(epoch from p_start)/604800)::integer);
 if exists(select 1 from private.weekly_results where starts_at=p_start) then return false; end if;
 ranked:=private.weekly_entries(p_start,p_start+interval '7 days'); winners:='[]'::jsonb;
 for winner in select value from jsonb_array_elements(ranked) with ordinality entries(value,n) order by n limit 5 loop
  position:=position+1;
  prize:=(array[500,350,250,150,100])[position];
  frame:=(array['frame-champion','frame-runnerup','frame-bronze','frame-finalist4','frame-finalist5'])[position];
  person:=(winner->>'userId')::uuid;
  perform private.credit_coins(person,'ranking:weekly:'||(extract(epoch from p_start)::bigint)::text||':'||position,prize);
  insert into public.inventory(user_id,item_id) values(person,frame) on conflict do nothing;
  winners:=winners||jsonb_build_array(winner||jsonb_build_object('position',position,'coinsAwarded',prize,'itemId',frame));
 end loop;
 insert into private.weekly_results(starts_at,ends_at,winners) values(p_start,p_start+interval '7 days',winners);
 return true;
end $$;
create function private.close_due_study_weeks() returns integer
language plpgsql security definer set search_path='' as $$
declare first_week timestamptz; candidate timestamptz; closed integer:=0;
begin
 select private.study_week(shop_rewards_started_at) into first_week from private.settings where singleton;
 for candidate in select generate_series(first_week,private.study_week(now())-interval '7 days',interval '7 days') loop
  if private.close_study_week(candidate) then closed:=closed+1; end if;
 end loop;
 return closed;
end $$;
create function public.weekly_ranking(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare starts timestamptz:=private.study_week(now()); ranked jsonb; latest private.weekly_results;
begin
 perform private.close_due_study_weeks();
 ranked:=private.weekly_entries(starts,starts+interval '7 days',p_user);
 select * into latest from private.weekly_results order by starts_at desc limit 1;
 return jsonb_build_object('startsAt',starts,'endsAt',starts+interval '7 days',
  'entries',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(ranked) with ordinality x(value,n) where (value->>'eligible')::boolean),'[]'::jsonb),
  'currentUser',(select value from jsonb_array_elements(ranked) x(value) where value->>'userId'=p_user::text),
  'lastCompleted',case when latest.starts_at is null then null else jsonb_build_object('startsAt',latest.starts_at,'endsAt',latest.ends_at,'winners',coalesce((select jsonb_agg(value||jsonb_build_object('isCurrentUser',value->>'userId'=p_user::text) order by n) from jsonb_array_elements(latest.winners) with ordinality x(value,n)),'[]'::jsonb)) end);
end $$;
revoke all on function private.study_week(timestamptz),private.study_day(timestamptz),private.reward_study_missions(),private.reward_collections(),private.shop_offers(timestamptz),private.weekly_entries(timestamptz,timestamptz,uuid),private.close_study_week(timestamptz),private.close_due_study_weeks(),public.weekly_ranking(uuid) from public,anon,authenticated;
revoke all on function public.shop_state(uuid),public.shop_purchase(uuid,text,text,integer),public.shop_equip(uuid,text,text) from public,anon,authenticated;
grant execute on function public.shop_state(uuid),public.shop_purchase(uuid,text,text,integer),public.shop_equip(uuid,text,text),public.weekly_ranking(uuid) to service_role;
select cron.schedule('rods-weekly-prizes','0 3 * * 1','select private.close_due_study_weeks()');
select cron.schedule('rods-weekly-prizes-recovery','5 * * * *','select private.close_due_study_weeks()');
commit;
