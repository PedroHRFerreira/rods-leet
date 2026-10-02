-- Email activation is an explicit operator action, separate from text receipt.
begin;
alter table private.settings add column feedback_mail_enabled boolean not null default false;
create or replace function private.wake_feedback_mail() returns void
language plpgsql security definer set search_path='' as $$
declare cfg private.settings;
begin
  select * into cfg from private.settings;
  if cfg.feedback_mail_enabled and cfg.coordinator_url ~ '/functions/v1/coordinator$' and cfg.coordinator_secret is not null
    and exists(select 1 from public.product_feedback where notification_status in ('pending','sending')) then
    perform net.http_post(url:=regexp_replace(cfg.coordinator_url,'/coordinator$','/feedback-mail'),
      headers:=jsonb_build_object('Content-Type','application/json','x-coordinator-secret',cfg.coordinator_secret),
      body:='{}',timeout_milliseconds:=5000);
  end if;
end $$;
commit;
