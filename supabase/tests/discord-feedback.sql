\set ON_ERROR_STOP on
begin;
do $$
declare
  u uuid:='40000000-0000-4000-8000-000000000001';
  receipt jsonb; replay jsonb; item jsonb; abandoned jsonb;
  old_protocol uuid; before_count integer; i integer;
begin
  insert into auth.users(id) values(u);
  perform public.admit_user(u,'','Public feedback author');
  -- Fixtures are transaction-local; preserve the persistent queue on rollback.
  update public.product_feedback set notification_status='sent' where notification_target='discord';
  insert into public.product_feedback(user_id,category,message,contact_email,idempotency_key)
    values(u,'criticism','Private historical feedback.','private@example.test','legacy') returning protocol into old_protocol;
  if public.claim_feedback_notification() is not null then raise exception 'legacy_worker_can_claim'; end if;
  if public.claim_discord_feedback_notification() is not null then raise exception 'private_history_published'; end if;
  begin
    perform public.submit_product_feedback(u,'praise','Private legacy request.',null,null,'retired');
    raise exception 'legacy_endpoint_still_accepts';
  exception when others then if sqlerrm<>'feedback_email_retired' then raise; end if; end;
  begin
    perform public.submit_discord_feedback(u,'criticism','Private historical feedback.',null,'legacy');
    raise exception 'private_idempotency_collision_accepted';
  exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
  receipt:=public.submit_discord_feedback(u,'suggestion','Public Discord feedback.',null,'public-first');
  replay:=public.submit_discord_feedback(u,'suggestion','Public Discord feedback.',null,'public-first');
  if replay<>receipt or (select count(*) from jsonb_object_keys(receipt))<>2 then raise exception 'durable_receipt_changed'; end if;
  if not exists(select 1 from public.product_feedback where protocol=(receipt->>'protocol')::uuid and notification_target='discord' and contact_email is null) then raise exception 'incorrect_public_record'; end if;
  begin
    perform public.submit_discord_feedback(u,'praise','Changed public message.',null,'public-first');
    raise exception 'payload_changed';
  exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
  begin
    perform public.submit_discord_feedback(u,'suggestion','Unknown challenge message.','unknown-feedback-challenge','unknown');
    raise exception 'unknown_challenge_accepted';
  exception when others then if sqlerrm<>'challenge_not_found' then raise; end if; end;
  begin
    perform public.submit_discord_feedback(u,'suggestion','Invalid'||chr(1)||'control message.',null,'control');
    raise exception 'control_message_accepted';
  exception when others then if sqlerrm<>'invalid_feedback_message' then raise; end if; end;
  item:=public.claim_discord_feedback_notification();
  if item->>'protocol' is distinct from receipt->>'protocol' or item->>'displayName'<>'Public feedback author' then raise exception 'claim_wrong_identity'; end if;
  if item ? 'contactEmail' or item ? 'userId' or item ? 'email' then raise exception 'private_data_in_public_payload'; end if;
  if (select count(*) from jsonb_object_keys(item))<>7 then raise exception 'unexpected_dispatch_field'; end if;
  if public.claim_feedback_notification() is not null or public.claim_discord_feedback_notification() is not null then raise exception 'duplicate_or_legacy_claim'; end if;
  if public.finish_feedback_notification((item->>'protocol')::uuid,gen_random_uuid(),true) then raise exception 'unowned_finish'; end if;
  if not public.finish_feedback_notification((item->>'protocol')::uuid,(item->>'token')::uuid,true) then raise exception 'owned_finish_failed'; end if;
  if public.finish_feedback_notification((item->>'protocol')::uuid,(item->>'token')::uuid,true) then raise exception 'finished_token_reused'; end if;
  if not exists(select 1 from public.product_feedback where protocol=old_protocol and notification_target='private' and notification_status='pending' and contact_email='private@example.test') then raise exception 'private_history_modified'; end if;
  perform public.submit_discord_feedback(u,'praise','Abandoned public notification.',null,'public-second');
  abandoned:=public.claim_discord_feedback_notification();
  update public.product_feedback set notification_started_at=now()-interval '3 minutes' where protocol=(abandoned->>'protocol')::uuid;
  if public.claim_discord_feedback_notification() is not null then raise exception 'ambiguous_delivery_replayed'; end if;
  if not exists(select 1 from public.product_feedback where protocol=(abandoned->>'protocol')::uuid and notification_status='uncertain') then raise exception 'missing_uncertain_state'; end if;
  if public.finish_feedback_notification((abandoned->>'protocol')::uuid,(abandoned->>'token')::uuid,true) then raise exception 'stale_token_accepted'; end if;
  -- Historical/private submissions still count against abuse quotas.
  begin
    perform public.submit_discord_feedback(u,'suggestion','A fourth hourly message.',null,'fourth');
    raise exception 'hourly_quota_bypassed';
  exception when others then if sqlerrm<>'feedback_hourly_limit' then raise; end if; end;
  if public.submit_discord_feedback(u,'suggestion','Public Discord feedback.',null,'public-first')<>receipt then raise exception 'quota_blocks_replay'; end if;
  for i in 4..10 loop
    insert into public.product_feedback(user_id,category,message,idempotency_key,created_at)
      values(u,'praise','Private quota fixture.','quota-'||i,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
  end loop;
  select count(*) into before_count from public.product_feedback where user_id=u;
  begin
    perform public.submit_discord_feedback(u,'suggestion','An eleventh daily message.',null,'eleventh');
    raise exception 'daily_quota_bypassed';
  exception when others then if sqlerrm<>'feedback_daily_limit' then raise; end if; end;
  if (select count(*) from public.product_feedback where user_id=u)<>before_count then raise exception 'rejected_record_persisted'; end if;
  if has_function_privilege('anon','public.submit_discord_feedback(uuid,text,text,text,text)','execute')
    or has_function_privilege('authenticated','public.submit_discord_feedback(uuid,text,text,text,text)','execute')
    or has_function_privilege('anon','public.claim_discord_feedback_notification()','execute')
    or has_function_privilege('authenticated','public.claim_discord_feedback_notification()','execute') then raise exception 'browser_dispatch_access'; end if;
  if not has_function_privilege('service_role','public.submit_discord_feedback(uuid,text,text,text,text)','execute') then raise exception 'server_submit_unavailable'; end if;
  if not (select relrowsecurity from pg_class where oid='public.product_feedback'::regclass)
    or exists(select 1 from pg_policies where schemaname='public' and tablename='product_feedback')
    or has_table_privilege('anon','public.product_feedback','select')
    or has_table_privilege('authenticated','public.product_feedback','select')
    or has_table_privilege('authenticated','public.product_feedback','insert')
    then raise exception 'private_history_access'; end if;
end $$;
rollback;
