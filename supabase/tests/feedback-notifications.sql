\set ON_ERROR_STOP on
begin;
do $$
declare u uuid:='30000000-0000-4000-8000-000000000001'; receipt jsonb; claimed jsonb; abandoned jsonb;
begin
  if (select feedback_mail_enabled from private.settings) then raise exception 'email_enabled_after_retirement'; end if;
  insert into auth.users(id) values(u);
  perform public.admit_user(u,'','Discord test');
  receipt:=public.submit_discord_feedback(u,'suggestion','Notification test message.',null,'discord-first');
  claimed:=public.claim_discord_feedback_notification();
  if claimed->>'protocol' is distinct from receipt->>'protocol' then raise exception 'wrong_claim'; end if;
  if public.claim_discord_feedback_notification() is not null then raise exception 'duplicate_claim'; end if;
  if public.finish_feedback_notification((claimed->>'protocol')::uuid,gen_random_uuid(),true) then raise exception 'unowned_finish'; end if;
  if not public.finish_feedback_notification((claimed->>'protocol')::uuid,(claimed->>'token')::uuid,true) then raise exception 'owned_finish_failed'; end if;
  if not exists(select 1 from public.product_feedback where protocol=(claimed->>'protocol')::uuid and notification_status='sent' and notification_sent_at is not null) then raise exception 'sent_not_persisted'; end if;
  if public.claim_discord_feedback_notification() is not null then raise exception 'sent_replayed'; end if;
  perform public.submit_discord_feedback(u,'praise','Abandoned notification test.',null,'discord-second');
  abandoned:=public.claim_discord_feedback_notification();
  update public.product_feedback set notification_started_at=now()-interval '3 minutes' where protocol=(abandoned->>'protocol')::uuid;
  if public.claim_discord_feedback_notification() is not null then raise exception 'abandoned_delivery_replayed'; end if;
  if not exists(select 1 from public.product_feedback where protocol=(abandoned->>'protocol')::uuid and notification_status='uncertain') then raise exception 'missing_uncertain_state'; end if;
  if public.finish_feedback_notification((abandoned->>'protocol')::uuid,(abandoned->>'token')::uuid,true) then raise exception 'stale_finish_accepted'; end if;
  perform public.submit_discord_feedback(u,'criticism','Uncertain notification test.',null,'discord-third');
  abandoned:=public.claim_discord_feedback_notification();
  if not public.finish_feedback_notification((abandoned->>'protocol')::uuid,(abandoned->>'token')::uuid,false) then raise exception 'uncertain_finish_failed'; end if;
  if public.claim_discord_feedback_notification() is not null then raise exception 'uncertain_delivery_replayed'; end if;
  if has_function_privilege('authenticated','public.claim_discord_feedback_notification()','execute') or has_function_privilege('anon','public.finish_feedback_notification(uuid,uuid,boolean)','execute') then raise exception 'client_can_dispatch_discord'; end if;
end $$;
rollback;
