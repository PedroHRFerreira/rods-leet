\set ON_ERROR_STOP on
begin;
create function pg_temp.visitor_submission(p_user uuid,p_attempt uuid,p_version text,p_kind text,p_status text,p_solution boolean default false) returns uuid
language plpgsql as $$
declare result uuid;
begin
 insert into public.submissions(user_id,attempt_id,challenge_version_id,language_id,kind,status,files,hint_snapshot,solution_snapshot,idempotency_key,runtime_version,template_id,manifest_sha256)
 values(p_user,p_attempt,p_version,'visitor-test',p_kind,p_status,'[]',0,p_solution,gen_random_uuid()::text,'test','test','test') returning id into result;
 return result;
end $$;
do $$
declare
 guest uuid:='60000000-0000-4000-8000-000000000001';
 a uuid; old_attempt uuid; pending_attempt uuid; pending_submission uuid; completed_attempt uuid; s uuid; i integer;
begin
 insert into auth.users(id,is_anonymous) values(guest,true);
 perform public.admit_user(guest,'','Visitor limit test');
 insert into private.runtimes(language_id,runtime_version) values('visitor-test','test');
 for i in 1..14 loop
  insert into public.challenge_versions(id,challenge_id,difficulty,base_xp,definition,published)
   values('visitor-'||i||':v1','visitor-'||i,'easy',20,
    case when i=11 then '{"kind":"quiz","quiz":{"options":[{"id":"a","text":"Answer"}]}}'::jsonb else '{}'::jsonb end,true);
 end loop;
 -- Opening an attempt early cannot bypass admission after ten completions.
 old_attempt:=(public.start_attempt(guest,'visitor-11:v1','normal','old-attempt')).id;
 for i in 1..9 loop
  a:=(public.start_attempt(guest,'visitor-'||i||':v1','normal','attempt-'||i)).id;
  s:=pg_temp.visitor_submission(guest,a,'visitor-'||i||':v1','submission','finished');
  insert into public.completions(user_id,challenge_id,mode,submission_id) values(guest,'visitor-'||i,'normal',s);
  if i=1 then completed_attempt:=a; end if;
 end loop;
 -- Multiple modes for one challenge do not consume another free challenge.
 insert into public.completions(user_id,challenge_id,mode,submission_id) values(guest,'visitor-9','hard',s);
 -- Solution practice is excluded by integrity controls and by the visible counter.
 a:=(public.start_attempt(guest,'visitor-13:v1','normal','solution-practice')).id;
 s:=pg_temp.visitor_submission(guest,a,'visitor-13:v1','submission','finished',true);
 insert into public.completions(user_id,challenge_id,mode,submission_id) values(guest,'visitor-13','normal',s);
 if (select count(distinct challenge_id) from public.completions where user_id=guest and reward_eligible)<>9 then raise exception 'practice_consumed_official_slot'; end if;
 -- A pending evaluation with an opened solution cannot reserve the final slot.
 a:=(public.start_attempt(guest,'visitor-14:v1','normal','pending-practice')).id;
 s:=pg_temp.visitor_submission(guest,a,'visitor-14:v1','submission','queued',true);
 begin
  perform public.submit_quiz(guest,old_attempt,'visitor-11:v1','a','accepted','{}','with-pending-practice');
  -- Roll back this successful tenth answer so the remaining assertions can run.
  raise exception 'rollback_successful_tenth';
 exception when others then if sqlerrm<>'rollback_successful_tenth' then raise; end if; end;
 update public.submissions set status='finished' where id=s;
 pending_attempt:=(public.start_attempt(guest,'visitor-10:v1','normal','tenth')).id;
 pending_submission:=pg_temp.visitor_submission(guest,pending_attempt,'visitor-10:v1','submission','queued');
 begin
  perform public.submit_quiz(guest,old_attempt,'visitor-11:v1','a','accepted','{}','pending-quiz');
  raise exception 'pending_completion_limit_bypassed';
 exception when others then if sqlerrm<>'execution_active' then raise; end if; end;
 update public.submissions set status='finished' where id=pending_submission;
 insert into public.completions(user_id,challenge_id,mode,submission_id) values(guest,'visitor-10','normal',pending_submission);
 begin
  perform public.start_attempt(guest,'visitor-12:v1','normal','eleventh');
  raise exception 'visitor_attempt_limit_bypassed';
 exception when others then if sqlerrm<>'visitor_challenge_limit' then raise; end if; end;
 begin
  perform public.submit_quiz(guest,old_attempt,'visitor-11:v1','a','accepted','{}','blocked-quiz');
  raise exception 'old_attempt_limit_bypassed';
 exception when others then if sqlerrm<>'visitor_challenge_limit' then raise; end if; end;
 -- Previously solved challenges stay available for practice.
 perform pg_temp.visitor_submission(guest,completed_attempt,'visitor-1:v1','run','finished');
 update auth.users set is_anonymous=false where id=guest;
 perform public.start_attempt(guest,'visitor-12:v1','normal','registered');
 perform public.submit_quiz(guest,old_attempt,'visitor-11:v1','a','accepted','{}','registered-quiz');
end $$;
rollback;
