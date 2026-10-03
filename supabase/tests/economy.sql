\set ON_ERROR_STOP on
begin;
do $$
declare
 u uuid:='40000000-0000-4000-8000-000000000001';
 guest uuid:='40000000-0000-4000-8000-000000000002';
 a uuid; sub uuid; i integer; balance integer; receipt jsonb; quoted integer;
begin
 insert into auth.users(id,is_anonymous) values(u,false),(guest,true);
 perform public.admit_user(u,'economy@example.test','Economy test');
 perform public.admit_user(guest,'','Guest test');
 if (public.shop_state(u)->>'coins')::integer<>0 then raise exception 'retroactive_wallet_reward'; end if;
 insert into private.runtimes(language_id,runtime_version) values('economy-test','test');
 insert into public.challenge_versions(id,challenge_id,difficulty,base_xp,definition,published)
  values('economy-test:v1','economy-test','easy',150,'{}',true);
 -- Independent study days award one milestone per sequence, even with same-day completions.
 for i in 1..30 loop
  insert into public.attempts(user_id,challenge_id,challenge_version_id,mode,state,idempotency_key)
   values(u,'economy-'||i,'economy-test:v1','normal','accepted','attempt-'||i) returning id into a;
  insert into public.submissions(user_id,attempt_id,challenge_version_id,language_id,kind,status,verdict,files,hint_snapshot,solution_snapshot,idempotency_key,runtime_version,template_id,manifest_sha256)
   values(u,a,'economy-test:v1','economy-test','submission','finished','accepted','[]',0,false,'sub-'||i,'test','test','test') returning id into sub;
  insert into public.completions(user_id,challenge_id,mode,submission_id,created_at)
   values(u,'economy-'||i,'normal',sub,((now() at time zone 'UTC')::date-30+i)::timestamp at time zone 'UTC');
 end loop;
 if (select coins from public.profiles where id=u)<>550 then raise exception 'completion_or_streak_reward_wrong'; end if;
 if not exists(select 1 from public.inventory where user_id=u and item_id='avatar-flame') then raise exception 'streak_gift_missing'; end if;
 -- A second mode for the same problem must not earn coins or another streak milestone.
 insert into public.completions(user_id,challenge_id,mode,submission_id) values(u,'economy-30','hard',sub);
 if (select coins from public.profiles where id=u)<>550 then raise exception 'duplicate_completion_rewarded'; end if;
 update public.profiles set xp=2250 where id=u;
 if (select coins from public.profiles where id=u)<>675 then raise exception 'multi_level_reward_wrong'; end if;
 if not exists(select 1 from public.inventory where user_id=u and item_id='avatar-scholar') then raise exception 'level_gift_missing'; end if;
 update public.profiles set xp=2250 where id=u;
 if (select coins from public.profiles where id=u)<>675 then raise exception 'unchanged_xp_rewarded'; end if;
 receipt:=public.shop_state(u);
 if (receipt->'offer'->>'price')::integer<100 or (receipt->'offer'->>'endsAt')::timestamptz-(receipt->'offer'->>'startsAt')::timestamptz<>interval '7 days' then raise exception 'invalid_weekly_offer'; end if;
 quoted:=case when receipt->'offer'->>'itemId'='avatar-robot' then (receipt->'offer'->>'price')::integer else 100 end;
 begin
  perform public.shop_purchase(u,'avatar-robot','stale-offer',quoted+1); raise exception 'stale_quote_charged';
 exception when others then if sqlerrm<>'price_changed' then raise; end if; end;
 perform public.shop_purchase(u,'avatar-robot','robot',quoted);
 select coins into balance from public.profiles where id=u;
 if balance<>675-quoted then raise exception 'wrong_authoritative_price'; end if;
 perform public.shop_purchase(u,'avatar-robot','robot',quoted);
 perform public.shop_purchase(u,'avatar-robot','robot-again',quoted);
 if (select coins from public.profiles where id=u)<>balance then raise exception 'permanent_purchase_debited_twice'; end if;
 begin
  perform public.shop_purchase(u,'hint-extra','robot',30); raise exception 'changed_payload_accepted';
 exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
 perform public.shop_equip(u,'avatar-robot','equip');
 perform public.shop_equip(u,'avatar-robot','equip');
 if (select avatar_id from public.profiles where id=u)<>'avatar-robot' then raise exception 'equip_missing'; end if;
 perform public.shop_equip(u,'avatar-default','reset-avatar');
 if (select avatar_id from public.profiles where id=u) is not null then raise exception 'reset_failed'; end if;
 begin
  perform public.shop_equip(u,'theme-ocean','unowned'); raise exception 'unowned_item_equipped';
 exception when others then if sqlerrm<>'item_not_owned' then raise; end if; end;
 perform public.shop_purchase(u,'hint-extra','hint',30);
 perform public.shop_purchase(u,'hint-extra','hint',30);
 if (select hint_balance from public.profiles where id=u)<>2 or (select coins from public.profiles where id=u)<>balance-30 then raise exception 'hint_purchase_replayed'; end if;
 begin
  perform public.shop_purchase(guest,'avatar-robot','guest',100); raise exception 'guest_purchase_allowed';
 exception when others then if sqlerrm<>'account_required' then raise; end if; end;
 begin
  perform public.shop_equip(guest,'avatar-robot','guest-equip'); raise exception 'guest_equip_allowed';
 exception when others then if sqlerrm<>'account_required' then raise; end if; end;
 -- Level locks and insufficient funds cannot debit or grant anything.
 update public.profiles set xp=0 where id=u;
 begin
  perform public.shop_purchase(u,'theme-sunset','locked',250); raise exception 'level_lock_bypassed';
 exception when others then if sqlerrm<>'item_locked' then raise; end if; end;
 perform private.credit_coins(u,'test-drain',-(select coins from public.profiles where id=u));
 begin
  perform public.shop_purchase(u,'hint-extra','empty',30); raise exception 'negative_wallet_allowed';
 exception when others then if sqlerrm<>'insufficient_coins' then raise; end if; end;
 if (select coins from public.profiles where id=u)<>0 then raise exception 'rejected_purchase_changed_wallet'; end if;
 if (select sum(amount) from public.coin_ledger where user_id=u)<>(select coins from public.profiles where id=u) then raise exception 'ledger_wallet_mismatch'; end if;
 if has_table_privilege('authenticated','public.coin_ledger','insert') or has_table_privilege('anon','public.inventory','select') or has_function_privilege('authenticated','public.shop_purchase(uuid,text,text,integer)','execute') or has_function_privilege('anon','public.shop_equip(uuid,text,text)','execute') then raise exception 'browser_economy_access'; end if;
 if not (select relrowsecurity from pg_class where oid='public.coin_ledger'::regclass) or not (select relrowsecurity from pg_class where oid='public.inventory'::regclass) then raise exception 'economy_rls_disabled'; end if;
end $$;
rollback;
