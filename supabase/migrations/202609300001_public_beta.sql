-- Public beta: anonymous identities, unlimited practice, one rewarded completion,
-- and a 15% base-reward reduction per rejected official submission.
begin;
alter table public.submissions add column execution_mode text not null default 'function'
  check(execution_mode in ('function','program'));
alter table public.submissions add column stdin text not null default '' check(octet_length(stdin)<=65536);
drop function public.enqueue_submission(uuid,uuid,text,text,text,jsonb,text);

create or replace function public.admit_user(
  p_user uuid,
  p_email text,
  p_name text,
  p_github_login text default null
) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
  -- Identity is verified against Auth /user by the signed server API.
  if not exists(select 1 from auth.users where id=p_user) then
    raise exception 'authentication_required';
  end if;
  select * into result from public.profiles where id=p_user;
  if found then return result; end if;
  insert into public.profiles(id,display_name)
  values(p_user,left(coalesce(nullif(p_name,''),'Jogador'),80))
  returning * into result;
  return result;
end $$;


create or replace function public.enqueue_submission(p_user uuid,p_attempt uuid,p_version text,p_language text,p_kind text,p_files jsonb,p_key text,p_execution_mode text default 'function',p_stdin text default '') returns public.submissions
language plpgsql security definer set search_path='' as $$
declare result public.submissions; a public.attempts; r private.runtimes; h private.assistance; cfg private.settings; mid bigint; day_utc date:=(now() at time zone 'UTC')::date;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'invite_required'; end if;
 select * into result from public.submissions where user_id=p_user and idempotency_key=p_key;
 if found then
  if result.attempt_id<>p_attempt or result.challenge_version_id<>p_version or result.language_id<>p_language or result.kind<>p_kind or result.files<>p_files or result.execution_mode<>p_execution_mode or result.stdin<>p_stdin then raise exception 'idempotency_conflict'; end if;
  return result;
 end if;
 select * into cfg from private.settings for update;
 if not cfg.execution_enabled then raise exception 'executor_unavailable'; end if;
 if cfg.credit_spent_usd+cfg.cost_per_job_usd>cfg.confirmed_credit_usd*0.8 or coalesce((select execution_usd from private.daily_budget where day=day_utc),0)+cfg.cost_per_job_usd>1 then raise exception 'budget_exhausted'; end if;
 select * into r from private.runtimes where language_id=p_language and homologated and template_id is not null and manifest_sha256 is not null;
 if not found then raise exception 'runtime_unavailable'; end if;
 select * into a from public.attempts where id=p_attempt and user_id=p_user for update;
 if not found or a.challenge_version_id<>p_version then raise exception 'attempt_not_found'; end if;
 if p_kind='submission' and (a.state<>'active' or (a.deadline_at is not null and a.deadline_at<now())) then raise exception 'attempt_closed'; end if;
 if p_kind='submission' and exists(select 1 from public.completions where user_id=p_user and challenge_id=a.challenge_id) then raise exception 'challenge_already_completed'; end if;
 if p_kind not in ('run','submission') then raise exception 'invalid_kind'; end if;
 if p_execution_mode not in ('function','program') then raise exception 'invalid_execution_mode'; end if;
 if p_stdin is null or octet_length(p_stdin)>65536 or (p_kind='submission' and p_stdin<>'') then raise exception 'invalid_stdin'; end if;
 if a.mode='hard' and p_kind='submission' and a.rejected_count+(select count(*) from public.submissions where attempt_id=a.id and kind='submission' and status<>'finished')>=3 then raise exception 'attempt_limit'; end if;
 if exists(select 1 from public.submissions where user_id=p_user and status<>'finished') then raise exception 'execution_active'; end if;
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 20 then raise exception 'invalid_files'; end if;
 if (select coalesce(sum(octet_length(f->>'content')),0) from jsonb_array_elements(p_files) f)>262144 then raise exception 'invalid_files'; end if;
 -- Reserve before enqueue, so pending jobs cannot oversubscribe tomorrow's budget.
 insert into private.daily_budget(day) values(day_utc) on conflict do nothing;
 update private.daily_budget set execution_usd=execution_usd+cfg.cost_per_job_usd where day=day_utc;
 update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd where singleton;
 insert into private.daily_usage(user_id,day) values(p_user,day_utc) on conflict do nothing;
 update private.daily_usage set executions=executions+1 where user_id=p_user and day=day_utc;
 insert into private.assistance(user_id,challenge_id) values(p_user,a.challenge_id) on conflict do nothing;
 select * into h from private.assistance where user_id=p_user and challenge_id=a.challenge_id;
 insert into public.submissions(user_id,attempt_id,challenge_version_id,language_id,kind,files,hint_snapshot,solution_snapshot,idempotency_key,runtime_version,template_id,manifest_sha256,execution_mode,stdin)
 values(p_user,p_attempt,p_version,p_language,p_kind,p_files,h.hints_used,h.solution_viewed,p_key,r.runtime_version,r.template_id,r.manifest_sha256,p_execution_mode,p_stdin) returning * into result;
 select pgmq.send('evaluations',jsonb_build_object('submissionId',result.id)) into mid;
 insert into private.jobs(submission_id,message_id,reserved_usd,reserved_day) values(result.id,mid,cfg.cost_per_job_usd,day_utc);
 return result;
end $$;

create or replace function public.finish_evaluation(p_submission uuid,p_lease uuid,p_verdict text,p_result jsonb,p_execution_ref text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare j private.jobs; s public.submissions; a public.attempts; v public.challenge_versions; reward integer; before_count integer; total_rejections integer;
begin
 select * into s from public.submissions where id=p_submission;
 if not found then return false; end if;
 perform 1 from public.profiles where id=s.user_id for update;
 select * into j from private.jobs where submission_id=p_submission for update;
 if not found or j.lease_token<>p_lease or j.lease_until<=clock_timestamp() then return false; end if;
 select * into s from public.submissions where id=p_submission for update;
 if s.status='finished' then return false; end if;
 if p_verdict not in ('accepted','wrong_answer','compile_error','runtime_error','time_limit','memory_limit','output_limit','infrastructure_error') then raise exception 'invalid_verdict'; end if;
 if p_verdict='infrastructure_error' and j.technical_attempts<3 then
  update public.submissions set status='queued' where id=s.id;
  update private.jobs set lease_until=null,lease_token=null where submission_id=s.id;
  perform pgmq.set_vt('evaluations',j.message_id,5);
  return true;
 end if;
 select * into a from public.attempts where id=s.attempt_id for update;
 select * into v from public.challenge_versions where id=s.challenge_version_id;
 update public.submissions set status='finished',verdict=p_verdict,public_result=p_result,execution_ref=p_execution_ref,finished_at=now() where id=s.id;
 if p_verdict='infrastructure_error' then
  update private.daily_usage set executions=greatest(0,executions-1) where user_id=s.user_id and day=(s.created_at at time zone 'UTC')::date;
 elsif s.kind='submission' and p_verdict='accepted' then
  select count(distinct challenge_id) into before_count from public.completions where user_id=s.user_id;
  insert into public.completions(user_id,challenge_id,mode,submission_id)
  select s.user_id,a.challenge_id,a.mode,s.id
  where not exists(select 1 from public.completions where user_id=s.user_id and challenge_id=a.challenge_id)
  on conflict do nothing;
  if found then
   select coalesce(sum(rejected_count),0) into total_rejections from public.attempts where user_id=s.user_id and challenge_id=a.challenge_id;
   reward:=case when s.solution_snapshot then 0 else floor(v.base_xp*greatest(0,1.0-0.15*total_rejections)*(case when a.mode='hard' then 3 else 1 end)*(case when s.hint_snapshot=0 then 1.0 when s.hint_snapshot=1 then 0.95 else 0.85 end)) end;
   insert into public.xp_events(user_id,submission_id,reason,amount) values(s.user_id,s.id,'completion',reward);
   update public.profiles set xp=xp+reward,reached_at=case when reward>0 then now() else reached_at end where id=s.user_id;
   if (select count(distinct challenge_id) from public.completions where user_id=s.user_id)>before_count and (before_count+1)%10=0 then update public.profiles set hint_balance=hint_balance+1 where id=s.user_id; end if;
  end if;
  update public.attempts set state='accepted' where id=a.id;
 elsif s.kind='submission' then
  update public.attempts set rejected_count=rejected_count+1,state=case when mode='hard' and rejected_count+1>=3 then 'exhausted' when deadline_at<=now() then 'expired' else state end where id=a.id;

 end if;
 perform pgmq.archive('evaluations',j.message_id);
 delete from private.jobs where submission_id=s.id;
 return true;
end $$;

revoke all on function public.enqueue_submission(uuid,uuid,text,text,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_submission(uuid,uuid,text,text,text,jsonb,text,text,text) to service_role;
alter table private.bff_sessions add column anonymous boolean not null default false;
create or replace function public.bff_session(p_op text,p_id text,p_payload text default null,p_version bigint default null,p_owner uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.bff_sessions; owner uuid;
begin
 if p_id !~ '^[a-f0-9]{64}$' then raise exception 'invalid_id'; end if;
 if p_op in ('create','create-anonymous','oauth-put') then
  if p_payload is null or length(p_payload)=0 or length(p_payload)>24576 then raise exception 'invalid_payload'; end if;
  insert into private.bff_sessions(id,kind,payload,expires_at,anonymous) values(p_id,case when p_op in ('create','create-anonymous') then 'session' else 'oauth' end,p_payload,now()+case when p_op='create' then interval '24 hours' when p_op='create-anonymous' then interval '30 days' else interval '10 minutes' end,p_op='create-anonymous') returning * into s;
 else
  select * into s from private.bff_sessions where id=p_id for update;
  if not found then return null; end if;
  if p_op='delete' then delete from private.bff_sessions where id=p_id; return null; end if;
  if s.expires_at<=now() or (s.kind='session' and not s.anonymous and s.touched_at+interval '2 hours'<=now()) then delete from private.bff_sessions where id=p_id; return null; end if;
  if p_op='oauth-take' then
   if s.kind<>'oauth' then return null; end if;
   delete from private.bff_sessions where id=p_id;
  elsif s.kind<>'session' then return null;
  elsif p_op='get' then
   update private.bff_sessions set touched_at=now() where id=p_id;
  elsif p_op='claim' then
   if s.lock_until>now() then return null; end if;
   owner=gen_random_uuid();
   update private.bff_sessions set lock_owner=owner,lock_until=now()+interval '30 seconds' where id=p_id;
   return jsonb_build_object('payload',s.payload,'version',s.version,'owner',owner,'expiresAt',s.expires_at);
  elsif p_op='update' then
   if p_owner is null or s.lock_owner is distinct from p_owner or s.lock_until<=now() or s.version is distinct from p_version then return null; end if;
   if p_payload is null or length(p_payload)=0 or length(p_payload)>24576 then raise exception 'invalid_payload'; end if;
   update private.bff_sessions set payload=p_payload,version=version+1,lock_owner=null,lock_until=null,touched_at=now() where id=p_id returning * into s;
  elsif p_op='release' then
   update private.bff_sessions set lock_owner=null,lock_until=null where id=p_id and lock_owner=p_owner;
   return null;
  else raise exception 'invalid_operation'; end if;
 end if;
 return jsonb_build_object('payload',s.payload,'version',s.version,'expiresAt',s.expires_at);
end $$;
select cron.schedule('security-state-cleanup','*/10 * * * *',$job$
 delete from private.bff_nonces where expires_at<now();
 delete from private.security_rates where started_at<now()-interval '1 hour';
 delete from private.bff_sessions where expires_at<now() or (kind='session' and not anonymous and touched_at<now()-interval '2 hours');
$job$);

commit;
