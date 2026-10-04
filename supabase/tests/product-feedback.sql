\set ON_ERROR_STOP on
begin;
do $$
declare
  u uuid := '10000000-0000-4000-8000-000000000001';
  other_user uuid := '10000000-0000-4000-8000-000000000002';
  receipt jsonb;
  before_count integer;
  i integer;
begin
  insert into auth.users(id) values(u),(other_user);
  perform public.admit_user(u,'','Anonymous feedback');
  perform public.admit_user(other_user,'','Independent feedback');
  insert into public.challenge_versions(id,challenge_id,difficulty,base_xp,definition,published)
    values('feedback-test:v1','feedback-test','easy',10,'{}',true);
  receipt := public.submit_discord_feedback(u,'suggestion','More examples please.','feedback-test','first');
  if receipt->>'protocol' is null or receipt->>'createdAt' is null or (select count(*) from jsonb_object_keys(receipt))<>2 then raise exception 'missing_durable_receipt'; end if;
  if not exists(select 1 from public.product_feedback where protocol=(receipt->>'protocol')::uuid and user_id=u and contact_email is null and notification_target='discord' and triage_status='pending') then raise exception 'receipt_without_persistence'; end if;
  if public.submit_discord_feedback(u,'suggestion','More examples please.','feedback-test','first')<>receipt then raise exception 'replay_changed_receipt'; end if;
  if (select count(*) from public.product_feedback where user_id=u)<>1 then raise exception 'replay_consumed_quota'; end if;
  begin
    perform public.submit_discord_feedback(u,'praise','Changed payload here.','feedback-test','first');
    raise exception 'changed_payload_accepted';
  exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
  begin
    perform public.submit_discord_feedback(u,'suggestion','More examples please.','nonexistent','unknown-challenge');
    raise exception 'unknown_challenge_accepted';
  exception when others then if sqlerrm<>'challenge_not_found' then raise; end if; end;
  begin
    perform public.submit_discord_feedback(u,'suggestion','short',null,'short');
    raise exception 'short_message_accepted';
  exception when others then if sqlerrm<>'invalid_feedback_message' then raise; end if; end;
  begin
    perform public.submit_discord_feedback(u,'suggestion','Invalid control'||chr(1)||'character.',null,'control');
    raise exception 'control_message_accepted';
  exception when others then if sqlerrm<>'invalid_feedback_message' then raise; end if; end;
  if (select count(*) from public.product_feedback where user_id=u)<>1 then raise exception 'rejected_feedback_persisted'; end if;
  perform public.submit_discord_feedback(u,'criticism','Second message here.',null,'second');
  perform public.submit_discord_feedback(u,'praise','Third message here.',null,'third');
  begin
    perform public.submit_discord_feedback(u,'suggestion','Fourth message here.',null,'fourth');
    raise exception 'hourly_limit_bypassed';
  exception when others then if sqlerrm<>'feedback_hourly_limit' then raise; end if; end;
  if public.submit_discord_feedback(u,'suggestion','More examples please.','feedback-test','first')<>receipt then raise exception 'quota_blocked_replay'; end if;
  -- A separate identity gets its own quota.
  perform public.submit_discord_feedback(other_user,'praise','An independent message.',null,'first');
  -- Direct fixture rows exercise daily quota deterministically even near UTC midnight.
  for i in 4..10 loop
    insert into public.product_feedback(user_id,category,message,idempotency_key,created_at)
      values(u,'praise','Daily quota fixture.','fixture-'||i,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
  end loop;
  select count(*) into before_count from public.product_feedback where user_id=u;
  begin
    perform public.submit_discord_feedback(u,'suggestion','An eleventh message.',null,'eleventh');
    raise exception 'daily_limit_bypassed';
  exception when others then if sqlerrm<>'feedback_daily_limit' then raise; end if; end;
  if (select count(*) from public.product_feedback where user_id=u)<>before_count then raise exception 'quota_failure_persisted'; end if;
  if public.submit_discord_feedback(u,'suggestion','More examples please.','feedback-test','first')<>receipt then raise exception 'daily_quota_blocked_replay'; end if;
  if not (select relrowsecurity from pg_class where oid='public.product_feedback'::regclass) then raise exception 'feedback_rls_disabled'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='product_feedback') then raise exception 'feedback_public_policy'; end if;
  if has_table_privilege('anon','public.product_feedback','select') or has_table_privilege('authenticated','public.product_feedback','select')
    or has_table_privilege('authenticated','public.product_feedback','insert') or has_table_privilege('authenticated','public.product_feedback','update')
    then raise exception 'browser_can_access_feedback'; end if;
  if has_function_privilege('anon','public.submit_discord_feedback(uuid,text,text,text,text)','execute')
    or has_function_privilege('authenticated','public.submit_discord_feedback(uuid,text,text,text,text)','execute') then raise exception 'browser_can_execute_feedback_rpc'; end if;
  if not has_function_privilege('service_role','public.submit_discord_feedback(uuid,text,text,text,text)','execute')
    or not has_table_privilege('service_role','public.product_feedback','select') or not has_table_privilege('service_role','public.product_feedback','update') then raise exception 'service_triage_unavailable'; end if;
end $$;
rollback;
