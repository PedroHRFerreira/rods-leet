-- Additive integrity controls. Never erase historical balances or learning progress.
begin;
alter table private.settings add column integrity_enabled boolean not null default false;
alter table public.submissions add column integrity_status text not null default 'clear'
 check(integrity_status in ('clear','pending_review','rejected'));
alter table public.completions add column reward_eligible boolean not null default true;
update public.completions c set reward_eligible=false from public.submissions s
 where s.id=c.submission_id and s.solution_snapshot;
create table private.integrity_reviews (
 protocol uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique references public.submissions(id),
 user_id uuid not null references public.profiles(id),
 reason text not null, evidence jsonb not null,
 state text not null default 'pending' check(state in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewer text, review_note text
);
create index integrity_pending_user on private.integrity_reviews(user_id,state);
alter table private.integrity_reviews enable row level security;
revoke all on private.integrity_reviews from public,anon,authenticated;
grant all on private.integrity_reviews to service_role;

create function private.guard_pending_submission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='submission' and exists(
  select 1 from private.integrity_reviews r
  join public.submissions s on s.id=r.submission_id
  join public.attempts previous on previous.id=s.attempt_id
  join public.attempts current on current.id=new.attempt_id
  where r.user_id=new.user_id and r.state='pending'
   and previous.challenge_id=current.challenge_id
 ) then raise exception 'integrity_pending'; end if;
 return new;
end $$;
create trigger integrity_pending_guard before insert on public.submissions
 for each row execute function private.guard_pending_submission();

create function private.assess_integrity() returns trigger
language plpgsql security definer set search_path='' as $$
declare burst integer; rapid integer; code_burst integer; code_rapid integer; reason text;
begin
 if new.kind<>'submission' or new.status<>'finished' or new.verdict<>'accepted'
  or new.solution_snapshot or not (select integrity_enabled from private.settings where singleton)
  or (tg_op='UPDATE' and old.status='finished') then return new; end if;
 -- All evidence comes from server timestamps and prior authoritative verdicts.
 -- Speed alone, clipboard events and browser fingerprints never decide a hold.
 select count(distinct s.challenge_version_id),
  count(*) filter(where s.created_at-a.started_at<interval '3 seconds'),
  count(distinct s.challenge_version_id) filter(where s.language_id<>'concept' and s.finished_at>now()-interval '2 minutes'),
  count(*) filter(where s.language_id<>'concept' and s.finished_at>now()-interval '2 minutes' and s.created_at-a.started_at<interval '3 seconds')
 into burst,rapid,code_burst,code_rapid
 from public.submissions s join public.attempts a on a.id=s.attempt_id
 where s.user_id=new.user_id and s.kind='submission' and s.status='finished' and s.verdict='accepted'
  and not s.solution_snapshot and s.id<>new.id and s.finished_at>now()-interval '5 minutes';
 if exists(select 1 from private.integrity_reviews where user_id=new.user_id and state='pending') then
  reason:='review_pending';
 elsif (burst>=19 and rapid>=10) or (code_burst>=5 and code_rapid>=3) then
  reason:='sustained_completion_burst';
 end if;
 if reason is not null then
  new.integrity_status:='pending_review';
 end if;
 return new;
end $$;
create trigger integrity_assess before insert or update on public.submissions
 for each row execute function private.assess_integrity();

create function private.record_integrity_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare evidence jsonb;
begin
 if new.integrity_status='pending_review' then
  select jsonb_build_object('policyVersion',1,'recordedAt',now(),
    'distinctAccepted5m',count(distinct s.challenge_version_id),
    'rapidAccepted5m',count(*) filter(where s.created_at-a.started_at<interval '3 seconds'),
    'distinctCodeAccepted2m',count(distinct s.challenge_version_id) filter(where s.language_id<>'concept' and s.finished_at>now()-interval '2 minutes'),
    'rapidCodeAccepted2m',count(*) filter(where s.language_id<>'concept' and s.finished_at>now()-interval '2 minutes' and s.created_at-a.started_at<interval '3 seconds'))
   into evidence from public.submissions s join public.attempts a on a.id=s.attempt_id
   where s.user_id=new.user_id and s.kind='submission' and s.status='finished' and s.verdict='accepted'
    and not s.solution_snapshot and s.id<>new.id and s.finished_at>now()-interval '5 minutes';
  insert into private.integrity_reviews(submission_id,user_id,reason,evidence)
  values(new.id,new.user_id,
   case when exists(select 1 from private.integrity_reviews where user_id=new.user_id and state='pending')
    then 'review_pending' else 'sustained_completion_burst' end,
   evidence) on conflict(submission_id) do nothing;
 end if;
 return new;
end $$;
create trigger integrity_record after insert or update on public.submissions
 for each row execute function private.record_integrity_review();

create function private.guard_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.submissions;
begin
 select * into s from public.submissions where id=new.submission_id;
 if s.integrity_status<>'clear' then return null; end if;
 new.reward_eligible:=not s.solution_snapshot;
 return new;
end $$;
create trigger integrity_completion before insert on public.completions
 for each row execute function private.guard_completion();

-- Extend the existing reward functions instead of duplicating the economy.
do $$
declare name text; definition text; patched text;
begin
 foreach name in array array['private.reward_completion()','private.reward_study_missions()'] loop
  select pg_get_functiondef(name::regprocedure) into definition;
  patched:=replace(definition,E'begin\n',E'begin\n if not new.reward_eligible then return new; end if;\n');
  if patched=definition then raise exception 'integrity_reward_patch_failed'; end if;
  execute patched;
 end loop;
 select pg_get_functiondef('private.weekly_entries(timestamptz,timestamptz,uuid)'::regprocedure) into definition;
 patched:=replace(definition,'where settings.singleton and c.created_at>=p_start',
  'where settings.singleton and c.reward_eligible and c.created_at>=p_start');
 if patched=definition then raise exception 'integrity_weekly_patch_failed'; end if;
 execute patched;
 -- Practice progress must not advance a competitive hint milestone.
 foreach name in array array['public.finish_evaluation(uuid,uuid,text,jsonb,text)','public.submit_quiz(uuid,uuid,text,text,text,jsonb,text)'] loop
  select pg_get_functiondef(name::regprocedure) into definition;
  patched:=replace(definition,
   'into before_count from public.completions where user_id=',
   'into before_count from public.completions where reward_eligible and user_id=');
  if name like 'public.finish_evaluation%' then
   patched:=replace(patched,
    'if (select count(distinct challenge_id) from public.completions where user_id=s.user_id)>before_count',
    'if not s.solution_snapshot and (select count(distinct challenge_id) from public.completions where reward_eligible and user_id=s.user_id)>before_count');
  end if;
  if patched=definition then raise exception 'integrity_hint_patch_failed'; end if;
  execute patched;
 end loop;
 -- The local executor has one active slot. Its queue must not grow with account farms.
 select pg_get_functiondef('public.enqueue_submission(uuid,uuid,text,text,text,jsonb,text,text,text)'::regprocedure) into definition;
 patched:=replace(definition,
  'if exists(select 1 from public.submissions where user_id=p_user and status<>''finished'') then raise exception ''execution_active''; end if;',
  'if exists(select 1 from public.submissions where user_id=p_user and status<>''finished'') then raise exception ''execution_active''; end if;'
  || E'\n if (select count(*) from public.submissions where status<>''finished'')>=4 then raise exception ''executor_busy''; end if;');
 if patched=definition then raise exception 'integrity_capacity_patch_failed'; end if;
 execute patched;
end $$;

create function public.integrity_summary(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('pendingCount',count(*)) from private.integrity_reviews where user_id=p_user and state='pending';
$$;
create function public.submission_review(p_user uuid,p_submission uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select protocol from private.integrity_reviews where user_id=p_user and submission_id=p_submission;
$$;

-- Operator-only review. No browser route grants this capability.
create function public.review_integrity(p_protocol uuid,p_decision text,p_reviewer text,p_note text) returns boolean
language plpgsql security definer set search_path='' as $$
declare review private.integrity_reviews; s public.submissions; a public.attempts; v public.challenge_versions;
 reward integer; total_rejections integer; before_count integer;
begin
 if p_decision is null or p_decision not in ('approved','rejected')
  or p_reviewer is null or length(p_reviewer) not between 2 and 100
  or p_note is null or length(p_note) not between 10 and 1000 then raise exception 'invalid_review'; end if;
 select * into review from private.integrity_reviews where protocol=p_protocol;
 if not found then raise exception 'review_not_found'; end if;
 -- Same lock ordering as submit_quiz/finish_evaluation prevents wallet races.
 perform 1 from public.profiles where id=review.user_id for update;
 select * into review from private.integrity_reviews where protocol=p_protocol for update;
 if review.state<>'pending' then
  if review.state<>p_decision then raise exception 'review_already_decided'; end if;
  return false;
 end if;
 select * into s from public.submissions where id=review.submission_id for update;
 select * into a from public.attempts where id=s.attempt_id for update;
 select * into v from public.challenge_versions where id=s.challenge_version_id;
 if s.status<>'finished' or s.verdict<>'accepted' then raise exception 'invalid_review'; end if;
 update private.integrity_reviews set state=p_decision,reviewed_at=now(),reviewer=p_reviewer,review_note=p_note where protocol=p_protocol;
 update public.submissions set integrity_status=case when p_decision='approved' then 'clear' else 'rejected' end where id=s.id;
 if p_decision='rejected' then
  update public.attempts set state='active' where id=a.id;
  return true;
 end if;
 select count(distinct challenge_id) into before_count from public.completions where reward_eligible and user_id=s.user_id;
 -- Credit on review day; never rewrite an already closed competitive week.
 insert into public.completions(user_id,challenge_id,mode,submission_id)
 select s.user_id,a.challenge_id,a.mode,s.id
 where not exists(select 1 from public.completions where user_id=s.user_id and challenge_id=a.challenge_id)
 on conflict do nothing;
 if found then
  select coalesce(sum(rejected_count),0) into total_rejections from public.attempts where user_id=s.user_id and challenge_id=a.challenge_id;
  reward:=case when s.solution_snapshot then 0 else floor(v.base_xp*greatest(0,1.0-0.15*total_rejections)
   *(case when a.mode='hard' then 3 else 1 end)
   *(case when s.hint_snapshot=0 then 1.0 when s.hint_snapshot=1 then 0.95 else 0.85 end)) end;
  insert into public.xp_events(user_id,submission_id,reason,amount) values(s.user_id,s.id,'completion',reward);
  update public.profiles set xp=xp+reward,reached_at=case when reward>0 then now() else reached_at end where id=s.user_id;
  if not s.solution_snapshot and (before_count+1)%10=0 then update public.profiles set hint_balance=hint_balance+1 where id=s.user_id; end if;
 end if;
 return true;
end $$;

revoke all on function private.assess_integrity(),private.record_integrity_review(),private.guard_completion(),private.guard_pending_submission(),
 public.integrity_summary(uuid),public.submission_review(uuid,uuid),public.review_integrity(uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.integrity_summary(uuid),public.submission_review(uuid,uuid),public.review_integrity(uuid,text,text,text) to service_role;
commit;
;
