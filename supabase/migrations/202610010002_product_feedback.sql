-- Text feedback is persisted for service-role triage. Contact email is unverified;
-- this migration neither sends mail nor accepts uploads.
begin;

create table public.product_feedback (
  protocol uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('suggestion','criticism','praise')),
  message text not null check (length(btrim(message)) between 10 and 4000),
  contact_email text check (contact_email is null or length(contact_email) between 3 and 254),
  challenge_id text,
  idempotency_key text not null check (length(idempotency_key) between 1 and 128),
  created_at timestamptz not null default now(),
  triage_status text not null default 'pending' check (triage_status in ('pending','reviewed','archived')),
  unique (user_id,idempotency_key)
);
create index product_feedback_user_created on public.product_feedback(user_id,created_at);
alter table public.product_feedback enable row level security;
-- No public/owner read or write policies: the authenticated API is the only writer.
revoke all on public.product_feedback from public,anon,authenticated;
grant select,insert,update,delete on public.product_feedback to service_role;

create function public.submit_product_feedback(
  p_user uuid,p_category text,p_message text,p_contact_email text,p_challenge text,p_key text
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
  if p_contact_email is not null and (length(p_contact_email)>254 or p_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid_feedback_email'; end if;
  if p_challenge is not null and (length(p_challenge)>128 or p_challenge !~ '^[a-zA-Z0-9_-]+$') then raise exception 'invalid_feedback_challenge'; end if;
  select * into result from public.product_feedback where user_id=p_user and idempotency_key=p_key;
  if found then
    if result.category is distinct from p_category or result.message is distinct from p_message
      or result.contact_email is distinct from p_contact_email or result.challenge_id is distinct from p_challenge
    then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('protocol',result.protocol,'createdAt',result.created_at);
  end if;
  if p_challenge is not null and not exists(select 1 from public.challenge_versions where challenge_id=p_challenge and published) then raise exception 'challenge_not_found'; end if;
  if (select count(*) from public.product_feedback where user_id=p_user and created_at>=day_start)>=10 then raise exception 'feedback_daily_limit'; end if;
  if (select count(*) from public.product_feedback where user_id=p_user and created_at>=now()-interval '1 hour')>=3 then raise exception 'feedback_hourly_limit'; end if;
  insert into public.product_feedback(user_id,category,message,contact_email,challenge_id,idempotency_key)
    values(p_user,p_category,p_message,p_contact_email,p_challenge,p_key) returning * into result;
  return jsonb_build_object('protocol',result.protocol,'createdAt',result.created_at);
end $$;

revoke all on function public.submit_product_feedback(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_product_feedback(uuid,text,text,text,text,text) to service_role;

commit;
