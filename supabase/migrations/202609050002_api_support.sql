create function public.user_context(p_user uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'assistance',coalesce((select jsonb_agg(to_jsonb(a)) from private.assistance a where user_id=p_user),'[]'),
  'usage',coalesce((select to_jsonb(u) from private.daily_usage u where user_id=p_user and day=(now() at time zone 'UTC')::date),'{"executions":0,"tutor_calls":0}'),
  'executionEnabled',(select execution_enabled from private.settings),
  'hardEnabled',(select hard_enabled from private.settings),
  'availableLanguages',coalesce((select jsonb_agg(language_id) from private.runtimes where homologated and template_id is not null),'[]'),
  'budgetAvailable',(select execution_enabled and credit_spent_usd+cost_per_job_usd<=confirmed_credit_usd*0.8 and coalesce((select execution_usd from private.daily_budget where day=(now() at time zone 'UTC')::date),0)+cost_per_job_usd<=1 from private.settings)
 );
$$;
create function public.finish_tutor(p_user uuid,p_key text,p_response jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 update private.idempotency set response=p_response where user_id=p_user and operation='tutor' and key=p_key;
 insert into private.tutor_interactions(user_id,response) values(p_user,left(p_response->>'message',8000));
end $$;
create function public.read_tutor(p_user uuid,p_key text) returns jsonb
language sql security definer set search_path='' as $$ select response from private.idempotency where user_id=p_user and operation='tutor' and key=p_key; $$;
revoke all on function public.user_context(uuid),public.finish_tutor(uuid,text,jsonb),public.read_tutor(uuid,text) from public,anon,authenticated;
grant execute on function public.user_context(uuid),public.finish_tutor(uuid,text,jsonb),public.read_tutor(uuid,text) to service_role;
