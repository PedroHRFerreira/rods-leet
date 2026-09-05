-- All writes go through the authenticated Edge API. No browser has service_role.
create extension if not exists pgmq;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
select pgmq.create('evaluations');

create table private.settings (
  singleton boolean primary key default true check(singleton),
  execution_enabled boolean not null default false,
  hard_enabled boolean not null default false,
  confirmed_credit_usd numeric(12,6) not null default 0 check(confirmed_credit_usd>=0),
  credit_spent_usd numeric(12,6) not null default 0,
  cost_per_job_usd numeric(12,6) not null default 0.02 check(cost_per_job_usd>0),
  last_sandbox_at timestamptz,
  coordinator_url text,
  coordinator_secret text
);
insert into private.settings default values;
create table private.invites(email text primary key check(email=lower(email)), created_at timestamptz not null default now());
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(display_name) between 1 and 80),
  xp integer not null default 0 check(xp>=0),
  hint_balance integer not null default 1 check(hint_balance>=0),
  reached_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.challenge_versions(
  id text primary key, challenge_id text not null, difficulty text not null check(difficulty in ('easy','medium','hard')),
  base_xp integer not null check(base_xp>0), is_boss boolean not null default false,
  definition jsonb not null, published boolean not null default false
);
create table private.runtimes(
  language_id text primary key, runtime_version text not null, template_id text,
  homologated boolean not null default false,
  -- Runtime manifest is verified against the root-owned manifest inside the template.
  manifest_sha256 text
);
create table public.attempts(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  challenge_id text not null, challenge_version_id text not null references public.challenge_versions(id),
  mode text not null check(mode in ('normal','hard')), started_at timestamptz not null default now(), deadline_at timestamptz,
  state text not null default 'active' check(state in ('active','accepted','expired','abandoned','exhausted')),
  rejected_count integer not null default 0, idempotency_key text not null,
  unique(user_id,idempotency_key)
);
create unique index active_attempt on public.attempts(user_id,challenge_id,mode) where state='active';
create table private.assistance(
  user_id uuid not null references public.profiles(id), challenge_id text not null,
  hints_used integer not null default 0, solution_viewed boolean not null default false,
  primary key(user_id,challenge_id)
);
create table public.submissions(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  attempt_id uuid not null references public.attempts(id), challenge_version_id text not null references public.challenge_versions(id),
  language_id text not null references private.runtimes(language_id), kind text not null check(kind in ('run','submission')),
  files jsonb, status text not null default 'queued' check(status in ('queued','running','finished')),
  verdict text check(verdict in ('accepted','wrong_answer','compile_error','runtime_error','time_limit','memory_limit','output_limit','infrastructure_error')),
  public_result jsonb, hint_snapshot integer not null, solution_snapshot boolean not null,
  idempotency_key text not null, provider text not null default 'e2b', runtime_version text not null,
  template_id text not null, manifest_sha256 text not null,
  execution_ref text, created_at timestamptz not null default now(), finished_at timestamptz,
  unique(user_id,idempotency_key)
);
create index submissions_attempt on public.submissions(attempt_id);
create table private.jobs(
  submission_id uuid primary key references public.submissions(id), message_id bigint not null,
  lease_token uuid, lease_until timestamptz, technical_attempts integer not null default 0,
  reserved_usd numeric(12,6) not null default 0, reserved_day date
);
create table private.daily_usage(
  user_id uuid not null references public.profiles(id), day date not null,
  executions integer not null default 0, tutor_calls integer not null default 0,
  primary key(user_id,day)
);
create table private.daily_budget(day date primary key, execution_usd numeric(12,6) not null default 0, neurons integer not null default 0);
create table public.completions(
  user_id uuid not null references public.profiles(id), challenge_id text not null, mode text not null,
  submission_id uuid not null references public.submissions(id), created_at timestamptz not null default now(),
  primary key(user_id,challenge_id,mode)
);
create table public.xp_events(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  submission_id uuid not null references public.submissions(id), reason text not null check(reason in ('completion','hard_rejection')),
  amount integer not null, created_at timestamptz not null default now(), unique(submission_id,reason)
);
create table public.drafts(
  user_id uuid not null references public.profiles(id), challenge_id text not null, language_id text not null,
  files jsonb not null, revision integer not null default 1, updated_at timestamptz not null default now(),
  primary key(user_id,challenge_id,language_id)
);
create table private.idempotency(user_id uuid not null, operation text not null, key text not null, response jsonb not null, primary key(user_id,operation,key));
create table private.tutor_interactions(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), challenge_id text, response text, created_at timestamptz not null default now());

alter table public.profiles enable row level security;
alter table public.challenge_versions enable row level security;
alter table public.attempts enable row level security;
alter table public.submissions enable row level security;
alter table public.completions enable row level security;
alter table public.xp_events enable row level security;
alter table public.drafts enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

-- Admission is serialized: accounts without an invitation never receive a profile.
create function public.admit_user(p_user uuid,p_email text,p_name text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
 perform pg_advisory_xact_lock(752100);
 if not exists(select 1 from private.invites where email=lower(p_email)) then raise exception 'invite_required'; end if;
 select * into result from public.profiles where id=p_user;
 if found then return result; end if;
 if (select count(*) from public.profiles)>=100 then raise exception 'beta_full'; end if;
 insert into public.profiles(id,display_name) values(p_user,left(coalesce(nullif(p_name,''),'Jogador'),80)) returning * into result;
 return result;
end $$;

create function public.start_attempt(p_user uuid,p_version text,p_mode text,p_key text) returns public.attempts
language plpgsql security definer set search_path='' as $$
declare result public.attempts; version public.challenge_versions; duration integer;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'invite_required'; end if;
 select * into result from public.attempts where user_id=p_user and idempotency_key=p_key;
 if found then
  if result.challenge_version_id<>p_version or result.mode<>p_mode then raise exception 'idempotency_conflict'; end if;
  return result;
 end if;
 select * into version from public.challenge_versions where id=p_version and published;
 if not found then raise exception 'challenge_unavailable'; end if;
 if p_mode not in ('normal','hard') then raise exception 'invalid_mode'; end if;
 if p_mode='hard' and not (select hard_enabled from private.settings) then raise exception 'hard_unavailable'; end if;
 update public.attempts set state='expired' where user_id=p_user and state='active' and deadline_at<now();
 select * into result from public.attempts where user_id=p_user and challenge_id=version.challenge_id and mode=p_mode and state='active';
 if found then return result; end if;
 if version.is_boss and (select count(*) from public.attempts where user_id=p_user and challenge_id=version.challenge_id and started_at>now()-interval '24 hours')>=3 then raise exception 'boss_limit'; end if;
 duration:=case version.difficulty when 'easy' then 45 when 'medium' then 60 else 90 end;
 insert into public.attempts(user_id,challenge_id,challenge_version_id,mode,deadline_at,idempotency_key)
 values(p_user,version.challenge_id,p_version,p_mode,case when p_mode='hard' then now()+make_interval(mins=>duration) end,p_key) returning * into result;
 return result;
end $$;

create function public.enqueue_submission(p_user uuid,p_attempt uuid,p_version text,p_language text,p_kind text,p_files jsonb,p_key text) returns public.submissions
language plpgsql security definer set search_path='' as $$
declare result public.submissions; a public.attempts; r private.runtimes; h private.assistance; cfg private.settings; mid bigint; day_utc date:=(now() at time zone 'UTC')::date;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'invite_required'; end if;
 select * into result from public.submissions where user_id=p_user and idempotency_key=p_key;
 if found then
  if result.attempt_id<>p_attempt or result.challenge_version_id<>p_version or result.language_id<>p_language or result.kind<>p_kind or result.files<>p_files then raise exception 'idempotency_conflict'; end if;
  return result;
 end if;
 select * into cfg from private.settings for update;
 if not cfg.execution_enabled then raise exception 'executor_unavailable'; end if;
 if cfg.credit_spent_usd+cfg.cost_per_job_usd>cfg.confirmed_credit_usd*0.8 or coalesce((select execution_usd from private.daily_budget where day=day_utc),0)+cfg.cost_per_job_usd>1 then raise exception 'budget_exhausted'; end if;
 select * into r from private.runtimes where language_id=p_language and homologated and template_id is not null and manifest_sha256 is not null;
 if not found then raise exception 'runtime_unavailable'; end if;
 select * into a from public.attempts where id=p_attempt and user_id=p_user for update;
 if not found or a.challenge_version_id<>p_version then raise exception 'attempt_not_found'; end if;
 if a.state<>'active' or (a.deadline_at is not null and a.deadline_at<now()) then raise exception 'attempt_closed'; end if;
 if p_kind not in ('run','submission') then raise exception 'invalid_kind'; end if;
 if a.mode='hard' and p_kind='submission' and a.rejected_count+(select count(*) from public.submissions where attempt_id=a.id and kind='submission' and status<>'finished')>=3 then raise exception 'attempt_limit'; end if;
 if exists(select 1 from public.submissions where user_id=p_user and status<>'finished') then raise exception 'execution_active'; end if;
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 20 then raise exception 'invalid_files'; end if;
 if (select coalesce(sum(octet_length(f->>'content')),0) from jsonb_array_elements(p_files) f)>262144 then raise exception 'invalid_files'; end if;
 -- Reserve before enqueue, so pending jobs cannot oversubscribe tomorrow's budget.
 insert into private.daily_budget(day) values(day_utc) on conflict do nothing;
 update private.daily_budget set execution_usd=execution_usd+cfg.cost_per_job_usd where day=day_utc;
 update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd;
 insert into private.daily_usage(user_id,day) values(p_user,day_utc) on conflict do nothing;
 update private.daily_usage set executions=executions+1 where user_id=p_user and day=day_utc and executions<10;
 if not found then raise exception 'daily_limit'; end if;
 insert into private.assistance(user_id,challenge_id) values(p_user,a.challenge_id) on conflict do nothing;
 select * into h from private.assistance where user_id=p_user and challenge_id=a.challenge_id;
 insert into public.submissions(user_id,attempt_id,challenge_version_id,language_id,kind,files,hint_snapshot,solution_snapshot,idempotency_key,runtime_version,template_id,manifest_sha256)
 values(p_user,p_attempt,p_version,p_language,p_kind,p_files,h.hints_used,h.solution_viewed,p_key,r.runtime_version,r.template_id,r.manifest_sha256) returning * into result;
 select pgmq.send('evaluations',jsonb_build_object('submissionId',result.id)) into mid;
 insert into private.jobs(submission_id,message_id,reserved_usd,reserved_day) values(result.id,mid,cfg.cost_per_job_usd,day_utc);
 return result;
end $$;

create function public.claim_evaluation() returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; message record; job private.jobs; sub public.submissions; token uuid:=gen_random_uuid(); day_utc date:=(now() at time zone 'UTC')::date;
begin
 select * into cfg from private.settings for update;
 if not cfg.execution_enabled or cfg.last_sandbox_at>clock_timestamp()-interval '1 second' then return null; end if;
 if (select count(*) from private.jobs where lease_until>clock_timestamp())>=4 then return null; end if;
 insert into private.daily_budget(day) values(day_utc) on conflict do nothing;
 select * into message from pgmq.read('evaluations',180,1);
 if not found then return null; end if;
 select * into job from private.jobs where message_id=message.msg_id for update;
 if not found then perform pgmq.archive('evaluations',message.msg_id); return null; end if;
 select * into sub from public.submissions where id=job.submission_id for update;
 if sub.status='finished' then perform pgmq.archive('evaluations',message.msg_id); return null; end if;
 if job.lease_until>clock_timestamp() then return null; end if;
 -- An expired lease consumed its reserved maximum. Never refund unconfirmed cloud cost.
 if not exists(select 1 from private.runtimes where language_id=sub.language_id and homologated) or job.technical_attempts>=3 or (job.technical_attempts=0 and job.reserved_day<>day_utc and (select execution_usd from private.daily_budget where day=day_utc)+job.reserved_usd>1) or (job.technical_attempts>0 and ((select execution_usd from private.daily_budget where day=day_utc)+cfg.cost_per_job_usd>1 or cfg.credit_spent_usd+cfg.cost_per_job_usd>cfg.confirmed_credit_usd*0.8)) then
  update public.submissions set status='finished',verdict='infrastructure_error',public_result='{"message":"Falha da infraestrutura. Sua tentativa foi preservada."}',finished_at=now() where id=sub.id;
  update private.daily_usage set executions=greatest(0,executions-1) where user_id=sub.user_id and day=(sub.created_at at time zone 'UTC')::date;
  if job.technical_attempts=0 then
   update private.settings set credit_spent_usd=credit_spent_usd-job.reserved_usd;
   update private.daily_budget set execution_usd=execution_usd-job.reserved_usd where day=job.reserved_day;
  end if;
  delete from private.jobs where submission_id=sub.id;
  perform pgmq.archive('evaluations',message.msg_id);
  return null;
 end if;
 if job.technical_attempts=0 and job.reserved_day<>day_utc then
  update private.daily_budget set execution_usd=execution_usd-job.reserved_usd where day=job.reserved_day;
  update private.daily_budget set execution_usd=execution_usd+job.reserved_usd where day=day_utc;
 end if;
 update private.jobs set lease_token=token,lease_until=clock_timestamp()+interval '180 seconds',technical_attempts=technical_attempts+1,reserved_usd=cfg.cost_per_job_usd,reserved_day=day_utc where submission_id=sub.id;
 if job.technical_attempts>0 then
  update private.daily_budget set execution_usd=execution_usd+cfg.cost_per_job_usd where day=day_utc;
  update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd;
 end if;
 update private.settings set last_sandbox_at=clock_timestamp();
 update public.submissions set status='running' where id=sub.id;
 return jsonb_build_object('submission',to_jsonb(sub),'leaseToken',token,'runtime',jsonb_build_object('language_id',sub.language_id,'runtime_version',sub.runtime_version,'template_id',sub.template_id,'manifest_sha256',sub.manifest_sha256));
end $$;

create function public.finish_evaluation(p_submission uuid,p_lease uuid,p_verdict text,p_result jsonb,p_execution_ref text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare j private.jobs; s public.submissions; a public.attempts; v public.challenge_versions; reward integer; before_count integer; delta integer;
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
  insert into public.completions(user_id,challenge_id,mode,submission_id) values(s.user_id,a.challenge_id,a.mode,s.id) on conflict do nothing;
  if found then
   reward:=case when s.solution_snapshot then 0 else floor(v.base_xp*(case when a.mode='hard' then 3 else 1 end)*(case when s.hint_snapshot=0 then 1.0 when s.hint_snapshot=1 then 0.95 else 0.85 end)) end;
   insert into public.xp_events(user_id,submission_id,reason,amount) values(s.user_id,s.id,'completion',reward);
   update public.profiles set xp=xp+reward,reached_at=case when reward>0 then now() else reached_at end where id=s.user_id;
   if (select count(distinct challenge_id) from public.completions where user_id=s.user_id)>before_count and (before_count+1)%10=0 then update public.profiles set hint_balance=hint_balance+1 where id=s.user_id; end if;
  end if;
  update public.attempts set state='accepted' where id=a.id;
 elsif s.kind='submission' then
  update public.attempts set rejected_count=rejected_count+1,state=case when mode='hard' and rejected_count+1>=3 then 'exhausted' when deadline_at<=now() then 'expired' else state end where id=a.id;
  if a.mode='hard' then
   select least(xp,30) into delta from public.profiles where id=s.user_id;
   insert into public.xp_events(user_id,submission_id,reason,amount) values(s.user_id,s.id,'hard_rejection',-delta) on conflict do nothing;
   if found then update public.profiles set xp=xp-delta,reached_at=now() where id=s.user_id; end if;
  end if;
 end if;
 perform pgmq.archive('evaluations',j.message_id);
 delete from private.jobs where submission_id=s.id;
 return true;
end $$;

create function public.consume_hint(p_user uuid,p_attempt uuid,p_key text,p_max_hints integer default 3) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.attempts; h private.assistance; response jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 select i.response into response from private.idempotency i where user_id=p_user and operation='hint:'||p_attempt and key=p_key;
 if found then return response; end if;
 select * into a from public.attempts where id=p_attempt and user_id=p_user;
 if not found or a.state<>'active' or a.deadline_at<now() then raise exception 'attempt_closed'; end if;
 insert into private.assistance(user_id,challenge_id) values(p_user,a.challenge_id) on conflict do nothing;
 select * into h from private.assistance where user_id=p_user and challenge_id=a.challenge_id for update;
 if h.hints_used>=p_max_hints then raise exception 'hints_exhausted'; end if;
 update public.profiles set hint_balance=hint_balance-1 where id=p_user and hint_balance>0;
 if not found then raise exception 'hint_balance_empty'; end if;
 update private.assistance set hints_used=hints_used+1 where user_id=p_user and challenge_id=a.challenge_id;
 response:=jsonb_build_object('hintIndex',h.hints_used,'hintsUsed',h.hints_used+1,'hintBalance',(select hint_balance from public.profiles where id=p_user));
 insert into private.idempotency values(p_user,'hint:'||p_attempt,p_key,response);
 return response;
end $$;

create function public.open_solution(p_user uuid,p_challenge text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare solved boolean; rejected integer; response jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 select i.response into response from private.idempotency i where user_id=p_user and operation='solution:'||p_challenge and key=p_key;
 if found then return response; end if;
 select exists(select 1 from public.completions where user_id=p_user and challenge_id=p_challenge) into solved;
 select coalesce(sum(rejected_count),0) into rejected from public.attempts where user_id=p_user and challenge_id=p_challenge;
 if not solved and rejected<3 then raise exception 'solution_locked'; end if;
 insert into private.assistance(user_id,challenge_id,solution_viewed) values(p_user,p_challenge,not solved)
 on conflict(user_id,challenge_id) do update set solution_viewed=private.assistance.solution_viewed or not solved;
 response:=jsonb_build_object('unlocked',true,'practiceOnly',(select solution_viewed from private.assistance where user_id=p_user and challenge_id=p_challenge));
 insert into private.idempotency values(p_user,'solution:'||p_challenge,p_key,response);
 return response;
end $$;

create function public.reserve_tutor(p_user uuid,p_challenge text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d date:=(now() at time zone 'UTC')::date; response jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 select i.response into response from private.idempotency i where user_id=p_user and operation='tutor' and key=p_key;
 if found then return response||'{"replayed":true}'::jsonb; end if;
 insert into private.daily_usage(user_id,day) values(p_user,d) on conflict do nothing;
 insert into private.daily_budget(day) values(d) on conflict do nothing;
 update private.daily_usage set tutor_calls=tutor_calls+1 where user_id=p_user and day=d and tutor_calls<2;
 if not found then raise exception 'tutor_daily_limit'; end if;
 -- Fixed input/output token caps; reserve 100 neurons conservatively per call.
 update private.daily_budget set neurons=neurons+100 where day=d and neurons<=7900;
 if not found then raise exception 'tutor_global_limit'; end if;
 response:=jsonb_build_object('reserved',true,'interactionId',gen_random_uuid());
 insert into private.idempotency values(p_user,'tutor',p_key,response);
 return response;
end $$;

create function public.save_draft(p_user uuid,p_challenge text,p_language text,p_files jsonb,p_revision integer) returns public.drafts
language plpgsql security definer set search_path='' as $$
declare result public.drafts;
begin
 perform 1 from public.profiles where id=p_user for update;
 insert into public.drafts(user_id,challenge_id,language_id,files) values(p_user,p_challenge,p_language,p_files)
 on conflict(user_id,challenge_id,language_id) do update set files=excluded.files,revision=public.drafts.revision+1,updated_at=now() where public.drafts.revision=p_revision returning * into result;
 if not found then raise exception 'draft_conflict'; end if;
 return result;
end $$;

-- Service-only access; explicit EXECUTE avoids PostgreSQL's default PUBLIC grant.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;

create function private.wake_coordinator() returns void language plpgsql security definer set search_path='' as $$
declare cfg private.settings;
begin
 select * into cfg from private.settings;
 if cfg.execution_enabled and cfg.coordinator_url is not null and cfg.coordinator_secret is not null and exists(select 1 from private.jobs) then
  perform net.http_post(url:=cfg.coordinator_url,headers:=jsonb_build_object('Content-Type','application/json','x-coordinator-secret',cfg.coordinator_secret),body:='{}',timeout_milliseconds:=5000);
 end if;
end $$;
select cron.schedule('codegamer-queue','* * * * *','select private.wake_coordinator()');
select cron.schedule('codegamer-retention','15 3 * * *',$cron$
 update public.submissions set files=null where status='finished' and verdict<>'accepted' and created_at<now()-interval '30 days';
 update public.submissions set public_result=public_result-'diagnostics' where status='finished' and created_at<now()-interval '7 days';
 delete from private.tutor_interactions where created_at<now()-interval '30 days';
 delete from pgmq.a_evaluations where archived_at<now()-interval '7 days';
 delete from cron.job_run_details where end_time<now()-interval '7 days';
$cron$);
