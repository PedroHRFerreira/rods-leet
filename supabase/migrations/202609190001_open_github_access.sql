-- Any verified GitHub account may create a profile. Historic invite tables remain
-- untouched for auditability, but no admission path reads them anymore.
create or replace function public.admit_user(
  p_user uuid,
  p_email text,
  p_name text,
  p_github_login text default null
) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
  if nullif(trim(coalesce(p_email,'')), '') is null then
    raise exception 'verified_email_required';
  end if;
  select * into result from public.profiles where id=p_user;
  if found then return result; end if;
  insert into public.profiles(id,display_name)
  values(p_user,left(coalesce(nullif(p_name,''),'Jogador'),80))
  returning * into result;
  return result;
end $$;

revoke all on function public.admit_user(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admit_user(uuid, text, text, text) to service_role;
