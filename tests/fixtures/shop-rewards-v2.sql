-- Isolated PostgreSQL fixtures only; never run on production.
begin;
create function pg_temp.complete_study(p_user uuid,p_challenge text,p_when timestamptz,p_xp integer default 0,p_mode text default 'normal',p_complete boolean default true) returns void
language plpgsql as $$
declare attempt uuid; submission uuid; key text:=gen_random_uuid()::text;
begin
 insert into public.attempts(user_id,challenge_id,challenge_version_id,mode,state,idempotency_key)
 values(p_user,p_challenge,'v2-test:v1',p_mode,'accepted',key) returning id into attempt;
 insert into public.submissions(user_id,attempt_id,challenge_version_id,language_id,kind,status,verdict,files,hint_snapshot,solution_snapshot,idempotency_key,runtime_version,template_id,manifest_sha256)
 values(p_user,attempt,'v2-test:v1','v2-test','submission','finished','accepted','[]',0,false,key,'test','test','test') returning id into submission;
 if p_complete then
  insert into public.completions(user_id,challenge_id,mode,submission_id,created_at) values(p_user,p_challenge,p_mode,submission,p_when);
 end if;
 insert into public.xp_events(user_id,submission_id,reason,amount,created_at) values(p_user,submission,case when p_xp<0 then 'hard_rejection' else 'completion' end,p_xp,p_when);
end $$;
do $$
declare
 week timestamptz:=private.study_week(now()); previous_week timestamptz:=private.study_week(now())-interval '7 days';
 u uuid:='50000000-0000-4000-8000-000000000001'; guest uuid:='50000000-0000-4000-8000-000000000002';
 people uuid[]:=array['51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000007','51000000-0000-4000-8000-000000000008','51000000-0000-4000-8000-000000000009','51000000-0000-4000-8000-000000000010']::uuid[];
 i integer; j integer; person uuid; balance integer; hints integer; original_xp integer; item text; charged integer; state jsonb; snapshot jsonb; ranking jsonb; browser_role text; prior_balance integer; prize_count integer;
begin
 if private.study_week(timestamptz '2026-10-05 02:59:59.999+00')<>timestamptz '2026-09-28 03:00:00+00' or private.study_week(timestamptz '2026-10-05 03:00:00+00')<>timestamptz '2026-10-05 03:00:00+00' then raise exception 'sao_paulo_week_boundary'; end if;
 if private.study_day(timestamptz '2026-10-05 02:59:59+00')<>timestamptz '2026-10-04 03:00:00+00' then raise exception 'sao_paulo_day_boundary'; end if;
 update private.settings set shop_rewards_started_at=week-interval '21 days'+interval '6 hours';
 insert into private.runtimes(language_id,runtime_version) values('v2-test','test');
 insert into public.challenge_versions(id,challenge_id,difficulty,base_xp,definition,published) values('v2-test:v1','v2-test','easy',150,'{}',true);
 insert into auth.users(id,is_anonymous) values(u,false),(guest,true);
 perform public.admit_user(u,'','Registered without email'); perform public.admit_user(guest,'','Anonymous');
 foreach person in array people loop
  insert into auth.users(id,is_anonymous) values(person,false); perform public.admit_user(person,'','Ranking test');
 end loop;
 -- First completion before publication cannot earn a mission after mode replay.
 perform pg_temp.complete_study(u,'before-publication',week-interval '28 days');
 perform pg_temp.complete_study(u,'before-publication',now(),0,'hard');
 if exists(select 1 from private.study_completions where user_id=u) then raise exception 'retroactive_mission_progress'; end if;
 select coins into balance from public.profiles where id=u;
 for i in 1..7 loop perform pg_temp.complete_study(u,'mission-'||i,now()); end loop;
 if (select coins from public.profiles where id=u)<>balance+70+20+75 then raise exception 'mission_rewards_wrong'; end if;
 select coins into balance from public.profiles where id=u;
 perform pg_temp.complete_study(u,'mission-7',now(),0,'hard');
 if (select coins from public.profiles where id=u)<>balance or (select count(*) from private.study_completions where user_id=u)<>7 then raise exception 'mission_replayed'; end if;
 state:=public.shop_state(u);
 if state->'missions'->0->>'progress'<>'3' or state->'missions'->0->>'claimed'<>'true' or state->'missions'->1->>'progress'<>'7' or state->'missions'->1->>'claimed'<>'true' then raise exception 'mission_state_mismatch'; end if;
 for i in 1..7 loop perform pg_temp.complete_study(guest,'guest-'||i,now()); end loop;
 if (select coins from public.profiles where id=guest)<>70 or exists(select 1 from private.study_completions where user_id=guest) then raise exception 'anonymous_mission_reward'; end if;
 if public.shop_state(guest)->'missions'->0->>'eligible'<>'false' then raise exception 'anonymous_mission_eligible'; end if;
 -- Registration does not silently backfill anonymous study.
 update auth.users set is_anonymous=false where id=guest;
 perform pg_temp.complete_study(guest,'guest-new',now());
 if (select count(*) from private.study_completions where user_id=guest)<>1 then raise exception 'anonymous_backfilled_on_registration'; end if;
 update auth.users set is_anonymous=true where id=guest;
 -- Catalog metadata is authoritative; all discounts are real and nonempty.
 state:=public.shop_state(u);
 if jsonb_array_length(state->'items')<>37 or jsonb_array_length(state->'offers')<>3 or jsonb_array_length(state->'collections')<>3 then raise exception 'v2_catalog_incomplete'; end if;
 for snapshot in select value from jsonb_array_elements(state->'offers') loop
  if not exists(select 1 from private.shop_items where id=snapshot->>'itemId' and acquisition='purchase' and price>(snapshot->>'price')::integer) then raise exception 'fake_offer_discount'; end if;
  if (snapshot->>'startsAt')::timestamptz<>week or (snapshot->>'endsAt')::timestamptz<>week+interval '7 days' then raise exception 'offer_period_mismatch'; end if;
 end loop;
 perform private.credit_coins(u,'test-funding',10000);
 select coins,hint_balance,xp into balance,hints,original_xp from public.profiles where id=u;
 perform public.shop_purchase(u,'hint-pack3','pack3',75);
 perform public.shop_purchase(u,'hint-pack3','pack3',75);
 perform public.shop_purchase(u,'hint-pack10','pack10',220);
 if (select hint_balance from public.profiles where id=u)<>hints+13 or (select coins from public.profiles where id=u)<>balance-295 or (select p.xp from public.profiles p where id=u)<>original_xp then raise exception 'hint_pack_not_atomic'; end if;
 begin perform public.shop_purchase(u,'hint-pack3','wrong-pack-price',30); raise exception 'forged_pack_price_accepted'; exception when others then if sqlerrm<>'price_changed' then raise; end if; end;
 begin perform public.shop_purchase(u,'frame-champion','buy-prize',0); raise exception 'ranking_prize_purchasable'; exception when others then if sqlerrm<>'item_not_purchasable' then raise; end if; end;
 begin perform public.shop_purchase(u,'avatar-scholar','buy-gift',0); raise exception 'milestone_gift_purchasable'; exception when others then if sqlerrm<>'item_not_purchasable' then raise; end if; end;
 begin perform public.shop_purchase(u,'title-neon','buy-collection-title',0); raise exception 'collection_gift_purchasable'; exception when others then if sqlerrm<>'item_not_purchasable' then raise; end if; end;
 -- Collection completion is transactional, permanent and grants exactly one title.
 update public.profiles set xp=2250 where id=u;
 foreach item in array array['avatar-robot-neon','name-neon-lime','theme-neon','frame-neon'] loop
  select coalesce((select (value->>'price')::integer from jsonb_array_elements(private.shop_offers(now())) where value->>'itemId'=item),price) into charged from private.shop_items where id=item;
  perform public.shop_purchase(u,item,'collection:'||item,charged);
 end loop;
 if (select count(*) from public.inventory where user_id=u and item_id='title-neon')<>1 then raise exception 'collection_title_missing'; end if;
 select coins into balance from public.profiles where id=u;
 perform public.shop_purchase(u,'frame-neon','frame-repeat',250);
 if (select coins from public.profiles where id=u)<>balance then raise exception 'owned_cosmetic_debited'; end if;
 perform public.shop_equip(u,'frame-neon','equip-frame'); perform public.shop_equip(u,'title-neon','equip-title');
 if not exists(select 1 from public.profiles where id=u and frame_id='frame-neon' and title_id='title-neon') then raise exception 'new_slots_not_equipped'; end if;
 begin perform public.shop_equip(u,'frame-champion','unowned-prize'); raise exception 'unowned_frame_equipped'; exception when others then if sqlerrm<>'item_not_owned' then raise; end if; end;
 perform public.shop_equip(u,'frame-default','reset-frame'); perform public.shop_equip(u,'title-default','reset-title');
 if exists(select 1 from public.profiles where id=u and (frame_id is not null or title_id is not null)) then raise exception 'new_slots_reset_failed'; end if;
 -- Prior week: 5 winners, deterministic challenge/time/id ties, net XP, and ineligibility.
 for i in 1..6 loop
  for j in 1..case when i=2 then 4 else 3 end loop
   perform pg_temp.complete_study(people[i],'rank-'||i||'-'||j,previous_week+make_interval(hours=>case when i=2 then 5 when i=4 then 2 else 1 end)+make_interval(mins=>j-1),case when j=1 then case when i=1 then 700 when i<=4 then 400 else 300 end else 0 end);
  end loop;
 end loop;
 perform pg_temp.complete_study(people[1],'penalty',previous_week+interval '4 hours',-200,'hard',false);
 for j in 1..2 loop perform pg_temp.complete_study(people[7],'min-'||j,previous_week+interval '1 hour',5000); end loop;
 for j in 1..3 loop perform pg_temp.complete_study(people[8],'zero-'||j,previous_week+interval '1 hour'); end loop;
 update public.profiles set xp=100000 where id=people[9]; -- Total balance cannot create weekly activity.
 for j in 1..3 loop perform pg_temp.complete_study(guest,'guest-rank-'||j,previous_week+interval '1 hour',5000); end loop;
 perform pg_temp.complete_study(people[10],'edge-1',previous_week+interval '1 hour',100);
 perform pg_temp.complete_study(people[10],'edge-2',week-interval '1 millisecond',100);
 perform pg_temp.complete_study(people[10],'edge-3',week,100);
 ranking:=private.weekly_entries(previous_week,week);
 if jsonb_array_length(ranking)<>6 or ranking->0->>'userId'<>people[1]::text or ranking->1->>'userId'<>people[2]::text or ranking->2->>'userId'<>people[3]::text or ranking->3->>'userId'<>people[4]::text or ranking->4->>'userId'<>people[5]::text or ranking->0->>'weeklyXp'<>'500' then raise exception 'weekly_order_or_eligibility'; end if;
 if ranking->0->>'reachedAt'<>(previous_week+interval '4 hours')::text then
  if (ranking->0->>'reachedAt')::timestamptz<>previous_week+interval '4 hours' then raise exception 'net_score_reached_time'; end if;
 end if;
 if private.close_study_week(week) then raise exception 'premature_payout'; end if;
 if private.close_study_week(week-interval '28 days') then raise exception 'historical_payout'; end if;
 select coins into prior_balance from public.profiles where id=people[1];
 if not private.close_study_week(previous_week) then raise exception 'week_not_closed'; end if;
 snapshot:=(select winners from private.weekly_results where starts_at=previous_week);
 if jsonb_array_length(snapshot)<>5 or snapshot->0->>'coinsAwarded'<>'500' or snapshot->4->>'coinsAwarded'<>'100' then raise exception 'podium_snapshot_wrong'; end if;
 for i in 1..5 loop
  if not exists(select 1 from public.inventory where user_id=people[i] and item_id=(array['frame-champion','frame-runnerup','frame-bronze','frame-finalist4','frame-finalist5'])[i]) then raise exception 'podium_frame_missing'; end if;
 end loop;
 if private.close_study_week(previous_week) or (select coins from public.profiles where id=people[1])<>prior_balance+500 then raise exception 'podium_replayed'; end if;
 update public.profiles set display_name='Changed after closure' where id=people[1];
 if (select winners from private.weekly_results where starts_at=previous_week)<>snapshot then raise exception 'snapshot_mutated'; end if;
 -- Same position another week earns that week's coins, one permanent frame.
 for j in 1..3 loop perform pg_temp.complete_study(people[1],'prior-'||j,previous_week-interval '7 days'+interval '1 hour',100); end loop;
 select coins into prior_balance from public.profiles where id=people[1];
 if not private.close_study_week(previous_week-interval '7 days') then raise exception 'prior_week_not_closed'; end if;
 if (select coins from public.profiles where id=people[1])<>prior_balance+500 or (select count(*) from public.inventory where user_id=people[1] and item_id='frame-champion')<>1 then raise exception 'permanent_prize_or_new_week_credit'; end if;
 -- Launch-week XP counts from Monday even before publication, but missions do not.
 perform pg_temp.complete_study(people[10],'launch-before-1',week-interval '21 days'+interval '1 hour',100);
 perform pg_temp.complete_study(people[10],'launch-before-2',week-interval '21 days'+interval '2 hours',100);
 ranking:=private.weekly_entries(week-interval '21 days',week-interval '14 days',people[10]);
 if ranking->0->>'weeklyXp'<>'200' or ranking->0->>'weeklyCompletedCount'<>'2' or exists(select 1 from private.study_completions where user_id=people[10] and challenge_id like 'launch-before-%') then raise exception 'launch_week_cutoff_wrong'; end if;
 -- Catch-up closes missing empty podium week once; no ineligible account receives prizes.
 select count(*) into prize_count from public.coin_ledger where source like 'ranking:weekly:%';
 if private.close_due_study_weeks()<>1 or private.close_due_study_weeks()<>0 or (select count(*) from public.coin_ledger where source like 'ranking:weekly:%')<>prize_count then raise exception 'catchup_empty_week_or_replay'; end if;
 if (select winners from private.weekly_results where starts_at=week-interval '21 days')<>'[]'::jsonb then raise exception 'empty_week_winner'; end if;
 state:=public.weekly_ranking(people[10]);
 if state->'currentUser'->>'eligible'<>'false' or state->'currentUser'->>'weeklyCompletedCount'<>'1' or state->'lastCompleted'->'winners'<>snapshot then
  -- isCurrentUser is personalized on read, so compare stable winner IDs instead.
  if state->'currentUser'->>'eligible'<>'false' or state->'currentUser'->>'weeklyCompletedCount'<>'1' or state->'lastCompleted'->'winners'->0->>'userId'<>people[1]::text then raise exception 'weekly_state_mismatch'; end if;
 end if;
 if public.weekly_ranking(guest)->'currentUser'<>'null'::jsonb then raise exception 'guest_weekly_eligible'; end if;
 -- Stable ledger identifiers survive sessions with different time zones.
 select coins into balance from public.profiles where id=u;
 perform set_config('TimeZone','America/Sao_Paulo',true);
 perform pg_temp.complete_study(u,'mission-extra',now());
 if (select coins from public.profiles where id=u)<>balance+10 then raise exception 'timezone_duplicate_mission'; end if;
 perform set_config('TimeZone','UTC',true);
 if (select sum(amount) from public.coin_ledger where user_id=u)<>(select coins from public.profiles where id=u) then raise exception 'v2_ledger_wallet_mismatch'; end if;
 -- Browser roles cannot spoof p_user, prices, ownership, XP or closed results.
 foreach browser_role in array array['anon','authenticated'] loop
  if has_table_privilege(browser_role,'public.profiles','UPDATE') or has_table_privilege(browser_role,'public.inventory','INSERT') or has_table_privilege(browser_role,'public.coin_ledger','UPDATE') or has_table_privilege(browser_role,'private.weekly_results','UPDATE') or has_function_privilege(browser_role,'public.shop_purchase(uuid,text,text,integer)','EXECUTE') or has_function_privilege(browser_role,'public.shop_equip(uuid,text,text)','EXECUTE') or has_function_privilege(browser_role,'public.weekly_ranking(uuid)','EXECUTE') or has_function_privilege(browser_role,'private.close_due_study_weeks()','EXECUTE') then raise exception 'browser_reward_write_access'; end if;
 end loop;
end $$;
do $$
declare browser_role text;
begin
 foreach browser_role in array array['anon','authenticated'] loop
  execute 'set local role '||quote_ident(browser_role);
  begin update public.profiles set xp=999999,coins=999999,frame_id='frame-champion'; raise exception 'browser_profile_manipulation'; exception when insufficient_privilege then null; end;
  begin insert into public.inventory(user_id,item_id) values('50000000-0000-4000-8000-000000000002','frame-champion'); raise exception 'browser_inventory_manipulation'; exception when insufficient_privilege then null; end;
  begin update private.weekly_results set winners='[]'; raise exception 'browser_podium_manipulation'; exception when insufficient_privilege then null; end;
  begin perform public.shop_purchase('50000000-0000-4000-8000-000000000001','hint-pack10','spoofed-user',0); raise exception 'browser_spoofed_rpc'; exception when insufficient_privilege then null; end;
  execute 'reset role';
 end loop;
end $$;
rollback;
