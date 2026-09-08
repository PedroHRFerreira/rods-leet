-- GitHub identities are checked by the API from auth.identities, never from editable user metadata.
create table private.github_invites(
  login text primary key check(
    login=lower(login)
    and login ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'
  ),
  source text not null default 'github_following',
  created_at timestamptz not null default now()
);

-- Snapshot of public personal accounts followed by PedroHRFerreira on 2026-09-07.
insert into private.github_invites(login) values
  ('idimetrix'),
  ('shahradelahi'),
  ('gschurck'),
  ('wkricowski'),
  ('diegosny'),
  ('rafaelsantos12'),
  ('wesley-gomes-sje'),
  ('felipegomesoliveira'),
  ('charles-chrismann'),
  ('0vm'),
  ('omatheuss'),
  ('george0st'),
  ('gabriellucasf'),
  ('daniellucasdev'),
  ('kelsonroberto'),
  ('yasir-shahzad'),
  ('gooddavvy'),
  ('thiagoofx'),
  ('dev-bryan-rodrigues'),
  ('lucasffa'),
  ('humbertodlacerda'),
  ('artuterra'),
  ('lucasdev-err'),
  ('danielzanotellisa'),
  ('victorhcss'),
  ('lrepo52')
on conflict (login) do nothing;

-- Replace the email-only signature so existing three-argument callers use the
-- defaulted GitHub login while the API can pass a verified identity explicitly.
drop function public.admit_user(uuid, text, text);
create or replace function public.admit_user(
  p_user uuid,
  p_email text,
  p_name text,
  p_github_login text default null
) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
  perform pg_advisory_xact_lock(752100);
  if not exists(select 1 from private.invites where email=lower(p_email))
    and not exists(
      select 1 from private.github_invites
      where login=lower(coalesce(p_github_login,''))
    )
  then raise exception 'invite_required'; end if;
  select * into result from public.profiles where id=p_user;
  if found then return result; end if;
  if (select count(*) from public.profiles)>=100 then raise exception 'beta_full'; end if;
  insert into public.profiles(id,display_name)
  values(p_user,left(coalesce(nullif(p_name,''),'Jogador'),80))
  returning * into result;
  return result;
end $$;

revoke all on function public.admit_user(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admit_user(uuid, text, text, text) to service_role;
