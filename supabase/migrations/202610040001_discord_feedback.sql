-- Only new, explicitly public feedback may enter the Discord queue.
-- Existing contact emails and messages remain private and are never migrated to Discord.
begin;
alter table public.product_feedback add column notification_target text not null default 'private'
  check (notification_target in ('private','discord'));
alter table public.product_feedback add constraint discord_feedback_without_contact
  check (notification_target<>'discord' or contact_email is null);
create index product_feedback_discord_pending on public.product_feedback(created_at)
  where notification_target='discord' and notification_status='pending';
alter table private.settings add column feedback_discord_enabled boolean not null default false;
update private.settings set feedback_mail_enabled=false;
-- Retire the old scheduler callback and legacy entry points: an old deployment
-- must neither accept private messages as public nor mail new public submissions.
create or replace function private.wake_feedback_mail() returns void
language plpgsql security definer set search_path='' as $$ begin return; end $$;
create or replace function public.submit_product_feedback(
  p_user uuid,p_category text,p_message text,p_contact_email text,p_challenge text,p_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'feedback_email_retired'; end $$;
create or replace function public.claim_feedback_notification() returns jsonb
language plpgsql security definer set search_path='' as $$ begin return null; end $$;

create function public.submit_discord_feedback(
  p_user uuid,p_category text,p_message text,p_challenge text,p_key text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  result public.product_feedback;
  day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  -- Lock the identity before replay and quotas so concurrent sends cannot overspend.
  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'authentication_required'; end if;
  if p_key is null or length(p_key) not between 1 and 128 then raise exception 'invalid_idempotency_key'; end if;
  if p_category is null or p_category not in ('suggestion','criticism','praise') then raise exception 'invalid_feedback_category'; end if;
  if p_message is null or length(btrim(p_message)) not between 10 and 4000
    or p_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'invalid_feedback_message'; end if;
  if p_challenge is not null and (length(p_challenge)>128 or p_challenge !~ '^[a-zA-Z0-9_-]+$') then raise exception 'invalid_feedback_challenge'; end if;
  select * into result from public.product_feedback where user_id=p_user and idempotency_key=p_key;
  if found then
    if result.notification_target<>'discord' then raise exception 'idempotency_conflict'; end if;
    if result.category is distinct from p_category or result.message is distinct from p_message
      or result.challenge_id is distinct from p_challenge
    then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('protocol',result.protocol,'createdAt',result.created_at);
  end if;
  if p_challenge is not null and not exists(select 1 from public.challenge_versions where challenge_id=p_challenge and published) then raise exception 'challenge_not_found'; end if;
  if (select count(*) from public.product_feedback where user_id=p_user and created_at>=day_start)>=10 then raise exception 'feedback_daily_limit'; end if;
  if (select count(*) from public.product_feedback where user_id=p_user and created_at>=now()-interval '1 hour')>=3 then raise exception 'feedback_hourly_limit'; end if;
  insert into public.product_feedback(user_id,category,message,challenge_id,idempotency_key,notification_target)
    values(p_user,p_category,p_message,p_challenge,p_key,'discord') returning * into result;
  return jsonb_build_object('protocol',result.protocol,'createdAt',result.created_at);
end $$;


revoke all on function public.submit_discord_feedback(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_discord_feedback(uuid,text,text,text,text) to service_role;

create function public.claim_discord_feedback_notification() returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.product_feedback; public_name text;
begin
  -- An ambiguous webhook response must not cause an automatic duplicate post.
  update public.product_feedback set notification_status='uncertain',notification_token=null
    where notification_target='discord' and notification_status='sending'
      and notification_started_at<now()-interval '2 minutes';
  select * into item from public.product_feedback
    where notification_target='discord' and notification_status='pending'
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.product_feedback set notification_status='sending',notification_token=gen_random_uuid(),notification_started_at=now()
    where protocol=item.protocol returning * into item;
  select display_name into public_name from public.profiles where id=item.user_id;
  return jsonb_build_object('protocol',item.protocol,'token',item.notification_token,'category',item.category,
    'message',item.message,'displayName',public_name,'challengeId',item.challenge_id,'createdAt',item.created_at);
end $$;
revoke all on function public.claim_discord_feedback_notification() from public,anon,authenticated;
grant execute on function public.claim_discord_feedback_notification() to service_role;

create function private.wake_feedback_discord() returns void
language plpgsql security definer set search_path='' as $$
declare cfg private.settings;
begin
  select * into cfg from private.settings;
  if cfg.feedback_discord_enabled and cfg.coordinator_url ~ '/functions/v1/coordinator$'
    and cfg.coordinator_secret is not null
    and exists(select 1 from public.product_feedback where notification_target='discord' and notification_status in ('pending','sending')) then
    perform net.http_post(url:=regexp_replace(cfg.coordinator_url,'/coordinator$','/feedback-discord'),
      headers:=jsonb_build_object('Content-Type','application/json','x-coordinator-secret',cfg.coordinator_secret),
      body:='{}',timeout_milliseconds:=5000);
  end if;
end $$;
revoke all on function private.wake_feedback_discord() from public,anon,authenticated;
select cron.schedule('rods-feedback-discord','* * * * *','select private.wake_feedback_discord()');
commit;
