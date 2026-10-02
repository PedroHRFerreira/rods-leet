begin;
alter table public.product_feedback
  add column notification_status text not null default 'pending' check (notification_status in ('pending','sending','sent','uncertain')),
  add column notification_token uuid,
  add column notification_started_at timestamptz,
  add column notification_sent_at timestamptz;
create index product_feedback_pending_notification on public.product_feedback(created_at) where notification_status='pending';

create function public.claim_feedback_notification() returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.product_feedback;
begin
  -- SMTP cannot guarantee replay safety after an ambiguous connection failure.
  -- Abandoned deliveries require human review, never an automatic resend.
  update public.product_feedback set notification_status='uncertain',notification_token=null
    where notification_status='sending' and notification_started_at<now()-interval '2 minutes';
  select * into item from public.product_feedback where notification_status='pending'
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.product_feedback set notification_status='sending',notification_token=gen_random_uuid(),notification_started_at=now()
    where protocol=item.protocol returning * into item;
  return jsonb_build_object('protocol',item.protocol,'category',item.category,'message',item.message,
    'contactEmail',item.contact_email,'challengeId',item.challenge_id,'createdAt',item.created_at,'token',item.notification_token);
end $$;

create function public.finish_feedback_notification(p_protocol uuid,p_token uuid,p_sent boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.product_feedback set notification_status=case when p_sent then 'sent' else 'uncertain' end,
    notification_sent_at=case when p_sent then now() else null end,notification_token=null
    where protocol=p_protocol and notification_token=p_token and notification_status='sending';
  return found;
end $$;
revoke all on function public.claim_feedback_notification(),public.finish_feedback_notification(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_feedback_notification(),public.finish_feedback_notification(uuid,uuid,boolean) to service_role;

create function private.wake_feedback_mail() returns void
language plpgsql security definer set search_path='' as $$
declare cfg private.settings;
begin
  select * into cfg from private.settings;
  if cfg.coordinator_url ~ '/functions/v1/coordinator$' and cfg.coordinator_secret is not null
    and exists(select 1 from public.product_feedback where notification_status in ('pending','sending')) then
    perform net.http_post(url:=regexp_replace(cfg.coordinator_url,'/coordinator$','/feedback-mail'),
      headers:=jsonb_build_object('Content-Type','application/json','x-coordinator-secret',cfg.coordinator_secret),
      body:='{}',timeout_milliseconds:=5000);
  end if;
end $$;
revoke all on function private.wake_feedback_mail() from public,anon,authenticated;
select cron.schedule('rods-feedback-mail','* * * * *','select private.wake_feedback_mail()');
commit;
