\set ON_ERROR_STOP on
begin;
do $$
declare n uuid:='00000000-0000-4000-8000-000000000004'; u uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; g uuid:='00000000-0000-4000-8000-000000000003';
 a public.attempts; s public.submissions; claim jsonb; before integer; h jsonb; i integer; prior_cost numeric; d date:=(now() at time zone 'UTC')::date;
begin
 insert into auth.users(id) values(u),(b),(g),(n);
 perform public.admit_user(n,'','Anonymous browser');
 if not exists(select 1 from public.profiles where id=n) then raise exception 'anonymous_not_admitted'; end if;
 perform public.admit_user(u,'one@example.test','One');perform public.admit_user(b,'two@example.test','Two');
 perform public.admit_user(g,'github@example.test','GitHub account','any-github-login');
 if not exists(select 1 from public.profiles where id=g) then raise exception 'github_account_not_admitted'; end if;
 insert into public.challenge_versions(id,challenge_id,difficulty,base_xp,definition,published) values('max:v1','max','easy',100,'{}',true);
 insert into private.runtimes(language_id,runtime_version,template_id,homologated,manifest_sha256) values('javascript','22.14.0','test-template',true,repeat('a',64)) on conflict(language_id) do update set runtime_version=excluded.runtime_version,template_id=excluded.template_id,homologated=excluded.homologated,manifest_sha256=excluded.manifest_sha256;
 update private.settings set execution_enabled=true,hard_enabled=true,confirmed_credit_usd=100,cost_per_job_usd=0.02;
 select * into a from public.start_attempt(u,'max:v1','normal','attempt1');
 h:=public.consume_hint(u,a.id,'hint1');
 if h->>'hintsUsed'<>'1' then raise exception 'hint_not_counted';end if;
 perform public.consume_hint(u,a.id,'hint1');
 if (select hint_balance from public.profiles where id=u)<>0 then raise exception 'hint_replay_charged';end if;
 select * into s from public.enqueue_submission(u,a.id,'max:v1','javascript','submission','[{"path":"solution.js","content":"export function findMax(){}"}]','submit1');
 perform public.enqueue_submission(u,a.id,'max:v1','javascript','submission',s.files,'submit1');
 if (select executions from private.daily_usage where user_id=u)<>1 then raise exception 'duplicate_charged';end if;
 update private.runtimes set template_id='different-new-template',runtime_version='99',manifest_sha256=repeat('b',64) where language_id='javascript';
 claim:=public.claim_evaluation();
 if claim->'runtime'->>'template_id'<>'test-template' or claim->'runtime'->>'runtime_version'<>'22.14.0' then raise exception 'runtime_snapshot_changed';end if;
 if public.finish_evaluation(s.id,gen_random_uuid(),'accepted','{}') then raise exception 'stale_lease_accepted';end if;
 if not public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}') then raise exception 'finalize_failed';end if;
 perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 if (select xp from public.profiles where id=u)<>95 then raise exception 'hint_reward_wrong';end if;
 if (select count(*) from public.xp_events where user_id=u)<>1 then raise exception 'duplicate_xp';end if;
 select * into a from public.start_attempt(u,'max:v1','normal','attempt2');
 begin
  perform public.enqueue_submission(u,a.id,'max:v1','javascript','submission','[{"path":"solution.js","content":"correct"}]','repeat-completed');
  raise exception 'completion_submitted_twice';
 exception when others then if sqlerrm<>'challenge_already_completed' then raise; end if; end;
 select * into s from public.enqueue_submission(u,a.id,'max:v1','javascript','run','[{"path":"solution.js","content":"correct"}]','practice-completed');
 update private.settings set last_sandbox_at=null;
 claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 if (select xp from public.profiles where id=u)<>95 then raise exception 'practice_rewarded_xp';end if;
 select * into a from public.start_attempt(b,'max:v1','hard','hard1');
 if a.deadline_at-a.started_at<>interval '45 minutes' then raise exception 'wrong_hard_deadline';end if;
 for i in 1..3 loop
  select * into s from public.enqueue_submission(b,a.id,'max:v1','javascript','submission','[{"path":"solution.js","content":"bad"}]','bad'||i);
  update private.settings set last_sandbox_at=null;
  claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'wrong_answer','{}');
 end loop;
 if (select state from public.attempts where id=a.id)<>'exhausted' then raise exception 'hard_not_exhausted';end if;
 if (select xp from public.profiles where id=b)<>0 then raise exception 'negative_xp';end if;
 h:=public.open_solution(b,'max','solution1');if not(h->>'practiceOnly')::boolean then raise exception 'solution_not_practice';end if;
 select * into a from public.start_attempt(b,'max:v1','normal','normal-b');
 select * into s from public.enqueue_submission(b,a.id,'max:v1','javascript','submission','[{"path":"solution.js","content":"correct"}]','practice');
 update private.settings set last_sandbox_at=null;
 claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 if (select xp from public.profiles where id=b)<>0 then raise exception 'solution_farmed_xp';end if;
 select * into a from public.start_attempt(u,'max:v1','normal','infra-attempt');
 select * into s from public.enqueue_submission(u,a.id,'max:v1','javascript','run','[{"path":"solution.js","content":"correct"}]','infra');
 select executions into before from private.daily_usage where user_id=u;
 for i in 1..3 loop
  update private.settings set last_sandbox_at=null;
  perform pgmq.set_vt('evaluations',(select message_id from private.jobs where submission_id=s.id),0);
  claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'infrastructure_error','{}');
 end loop;
 if (select executions from private.daily_usage where user_id=u)<>before-1 then raise exception 'infra_quota_not_refunded';end if;
 if (select rejected_count from public.attempts where id=a.id)<>0 then raise exception 'infra_counted_as_rejection';end if;
 -- A queued reservation crossing UTC midnight must debit the creation day.
 select * into s from public.enqueue_submission(u,a.id,'max:v1','javascript','run','[{"path":"solution.js","content":"correct"}]','midnight');
 update private.jobs set reserved_day=d-1 where submission_id=s.id;
 update private.daily_budget set execution_usd=execution_usd-0.02 where day=d;
 insert into private.daily_budget(day,execution_usd) values(d-1,0.02) on conflict(day) do update set execution_usd=private.daily_budget.execution_usd+0.02;
 select execution_usd into prior_cost from private.daily_budget where day=d;
 update private.settings set last_sandbox_at=null;
 claim:=public.claim_evaluation();
 if (select execution_usd from private.daily_budget where day=d)<>prior_cost+0.02 then raise exception 'midnight_budget_bypass';end if;
 perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 -- Anonymous progress stays attached to the browser on a later day.
 perform public.bff_session('create-anonymous',repeat('f',64),'ciphertext');
 update private.bff_sessions set touched_at=now()-interval '1 day' where id=repeat('f',64);
 if public.bff_session('get',repeat('f',64)) is null then raise exception 'anonymous_progress_lost_after_idle'; end if;
 if (select expires_at from private.bff_sessions where id=repeat('f',64))<now()+interval '29 days' then raise exception 'anonymous_session_expiry_too_short'; end if;
 -- Anonymous practice has no daily user quota; practice after approval stays open.
 select * into a from public.start_attempt(n,'max:v1','normal','anon-attempt');
 update private.settings set cost_per_job_usd=0;
 for i in 1..15 loop
  select * into s from public.enqueue_submission(n,a.id,'max:v1','javascript','run','[{"path":"solution.js","content":"console.log(42)"}]','anon-run-'||i,'program','');
  if s.execution_mode<>'program' then raise exception 'program_mode_lost'; end if;
  update private.settings set last_sandbox_at=null;
  claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 end loop;
 if (select executions from private.daily_usage where user_id=n and day=d)<>15 then raise exception 'practice_daily_limit'; end if;
 -- A rejected official answer costs 15% of this challenge's reward, never existing XP.
 update public.profiles set xp=200 where id=n;
 select * into s from public.enqueue_submission(n,a.id,'max:v1','javascript','submission','[{"path":"solution.js","content":"bad"}]','anon-wrong','program','');
 update private.settings set last_sandbox_at=null;
 claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'wrong_answer','{}');
 if (select xp from public.profiles where id=n)<>200 then raise exception 'rejection_debited_earned_xp'; end if;
 select * into s from public.enqueue_submission(n,a.id,'max:v1','javascript','submission','[{"path":"solution.js","content":"correct"}]','anon-correct','program','');
 update private.settings set last_sandbox_at=null;
 claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 if (select xp from public.profiles where id=n)<>285 then raise exception 'wrong_reward_reduction'; end if;
 select * into s from public.enqueue_submission(n,a.id,'max:v1','javascript','run','[{"path":"solution.js","content":"correct"}]','anon-after-accepted');
 update private.settings set last_sandbox_at=null;
 claim:=public.claim_evaluation();perform public.finish_evaluation(s.id,(claim->>'leaseToken')::uuid,'accepted','{}');
 update private.settings set cost_per_job_usd=0.02;
 -- Optimistic draft revisions come from the client, never inferred from its clock.
 perform public.save_draft(u,'max','javascript','[{"path":"solution.js","content":"A"}]',0);
 perform public.save_draft(u,'max','javascript','[{"path":"solution.js","content":"B"}]',1);
 begin perform public.save_draft(u,'max','javascript','[{"path":"solution.js","content":"stale"}]',1);raise exception 'stale_draft_overwrite';exception when others then if sqlerrm<>'draft_conflict' then raise;end if;end;
 if (select files->0->>'content' from public.drafts where user_id=u)<>'B' then raise exception 'draft_changed_after_conflict';end if;
 update private.settings set confirmed_credit_usd=0;
 begin perform public.enqueue_submission(u,a.id,'max:v1','javascript','run','[{"path":"solution.js","content":"correct"}]','budget');raise exception 'budget_overspent';exception when others then if sqlerrm<>'budget_exhausted' then raise;end if;end;
 if has_function_privilege('authenticated','public.finish_evaluation(uuid,uuid,text,jsonb,text)','EXECUTE') then raise exception 'browser_can_finalize';end if;
 if has_table_privilege('authenticated','private.assistance','SELECT') then raise exception 'private_data_exposed';end if;
 raise notice 'PASS: anonymous/GitHub admission, unlimited practice, one completion, 15 percent reward reduction, idempotency, hint accounting, stale fencing, Hard timer, solution practice, infrastructure retries, budget and privileges';
end $$;
rollback;
