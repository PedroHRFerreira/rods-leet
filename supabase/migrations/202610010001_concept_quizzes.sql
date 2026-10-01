-- Concept questions finish synchronously and never reserve executor resources.
begin;

insert into private.runtimes(language_id,runtime_version,template_id,manifest_sha256,homologated)
values('concept','concept-v1','concept-v1',repeat('0',64),false)
on conflict(language_id) do nothing;

create or replace function public.submit_quiz(
  p_user uuid,
  p_attempt uuid,
  p_version text,
  p_option text,
  p_verdict text,
  p_result jsonb,
  p_key text
) returns public.submissions
language plpgsql security definer set search_path='' as $$
declare
  result public.submissions;
  a public.attempts;
  v public.challenge_versions;
  r private.runtimes;
  answer_files jsonb;
  reward integer;
  before_count integer;
  total_rejections integer;
begin
  -- Only the authenticated server API calls this RPC after private validation.
  -- Serializing the profile protects completion, XP and the ten-completion bonus.
  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'invite_required'; end if;
  if p_option is null or p_option='' or length(p_option)>100 then raise exception 'invalid_option'; end if;
  if p_key is null or length(p_key) not between 1 and 200 then raise exception 'invalid_idempotency_key'; end if;
  answer_files:=jsonb_build_array(jsonb_build_object('path','answer.json','content',jsonb_build_object('optionId',p_option)::text));
  select * into result from public.submissions where user_id=p_user and idempotency_key=p_key;
  if found then
    if result.attempt_id is distinct from p_attempt
      or result.challenge_version_id is distinct from p_version
      or result.language_id<>'concept' or result.provider<>'quiz'
      or result.kind<>'submission' or result.files is distinct from answer_files
    then raise exception 'idempotency_conflict'; end if;
    return result;
  end if;
  if p_verdict is null or p_verdict not in ('accepted','wrong_answer') then raise exception 'invalid_verdict'; end if;
  if p_result is null or jsonb_typeof(p_result)<>'object' then raise exception 'invalid_result'; end if;
  select * into v from public.challenge_versions where id=p_version and published;
  if not found or v.definition->>'kind' is distinct from 'quiz' then raise exception 'challenge_unavailable'; end if;
  if jsonb_typeof(v.definition->'quiz'->'options') is distinct from 'array' then raise exception 'invalid_option'; end if;
  if not exists(select 1 from jsonb_array_elements(v.definition->'quiz'->'options') option where option->>'id'=p_option) then raise exception 'invalid_option'; end if;
  select * into a from public.attempts where id=p_attempt and user_id=p_user for update;
  if not found or a.challenge_version_id is distinct from p_version or a.challenge_id is distinct from v.challenge_id then raise exception 'attempt_not_found'; end if;
  if exists(select 1 from public.completions where user_id=p_user and challenge_id=a.challenge_id) then raise exception 'challenge_already_completed'; end if;
  if a.mode<>'normal' then raise exception 'invalid_mode'; end if;
  if a.state<>'active' or (a.deadline_at is not null and a.deadline_at<now()) then raise exception 'attempt_closed'; end if;
  select * into r from private.runtimes where language_id='concept'
    and runtime_version='concept-v1' and template_id='concept-v1'
    and manifest_sha256=repeat('0',64) and not homologated;
  if not found then raise exception 'runtime_unavailable'; end if;
  insert into public.submissions(
    user_id,attempt_id,challenge_version_id,language_id,kind,files,status,verdict,public_result,
    hint_snapshot,solution_snapshot,idempotency_key,provider,runtime_version,template_id,manifest_sha256,finished_at
  ) values(
    p_user,p_attempt,p_version,'concept','submission',answer_files,'finished',p_verdict,p_result,
    0,false,p_key,'quiz',r.runtime_version,r.template_id,r.manifest_sha256,now()
  ) returning * into result;
  if p_verdict='wrong_answer' then
    update public.attempts set rejected_count=rejected_count+1 where id=a.id;
    return result;
  end if;
  select count(distinct challenge_id) into before_count from public.completions where user_id=p_user;
  insert into public.completions(user_id,challenge_id,mode,submission_id)
  values(p_user,a.challenge_id,'normal',result.id) on conflict do nothing;
  if found then
    select coalesce(sum(rejected_count),0) into total_rejections from public.attempts where user_id=p_user and challenge_id=a.challenge_id;
    reward:=floor(v.base_xp*greatest(0,1.0-0.15*total_rejections));
    insert into public.xp_events(user_id,submission_id,reason,amount) values(p_user,result.id,'completion',reward);
    update public.profiles set xp=xp+reward,reached_at=case when reward>0 then now() else reached_at end where id=p_user;
    if (before_count+1)%10=0 then update public.profiles set hint_balance=hint_balance+1 where id=p_user; end if;
  end if;
  update public.attempts set state='accepted' where id=a.id;
  return result;
end $$;

revoke all on function public.submit_quiz(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_quiz(uuid,uuid,text,text,text,jsonb,text) to service_role;

commit;
