create table private.tutor_conversations(
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id text not null default 'general',
  language_id text not null default 'general',
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  primary key(user_id,challenge_id,language_id),
  check(jsonb_typeof(messages)='array')
);
create index tutor_conversations_expiry on private.tutor_conversations(expires_at);

create function public.read_tutor_conversation(
  p_user uuid,p_challenge text,p_language text
) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce((
    select messages from private.tutor_conversations
    where user_id=p_user and challenge_id=p_challenge and language_id=p_language
      and expires_at>now()
  ),'[]'::jsonb)
$$;

create function public.write_tutor_conversation(
  p_user uuid,p_challenge text,p_language text,p_messages jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(p_messages)<>'array' or jsonb_array_length(p_messages)>12 then
    raise exception 'invalid_tutor_conversation';
  end if;
  insert into private.tutor_conversations(user_id,challenge_id,language_id,messages,updated_at,expires_at)
  values(p_user,p_challenge,p_language,p_messages,now(),now()+interval '30 days')
  on conflict(user_id,challenge_id,language_id) do update
    set messages=excluded.messages,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
  return p_messages;
end $$;

create function public.clear_tutor_conversation(
  p_user uuid,p_challenge text,p_language text
) returns void
language sql security definer set search_path='' as $$
  delete from private.tutor_conversations
  where user_id=p_user and challenge_id=p_challenge and language_id=p_language
$$;

revoke all on function public.read_tutor_conversation(uuid,text,text),public.write_tutor_conversation(uuid,text,text,jsonb),public.clear_tutor_conversation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.read_tutor_conversation(uuid,text,text),public.write_tutor_conversation(uuid,text,text,jsonb),public.clear_tutor_conversation(uuid,text,text) to service_role;

-- Retention is enforced in reads and physically cleaned each night so expired
-- conversations never remain as dormant personal data.
select cron.schedule('rods-leet-tutor-conversation-retention','30 3 * * *',$cron$
  delete from private.tutor_conversations where expires_at <= now();
$cron$);
