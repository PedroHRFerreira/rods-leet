-- The Oracle beta worker has one delegated cgroup. Reject a second job before
-- it reserves a quota, an attempt or a queue message.
do $$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.enqueue_submission(uuid,uuid,text,text,text,jsonb,text)'::regprocedure
  ) into definition;
  patched := replace(
    definition,
    'if exists(select 1 from public.submissions where user_id=p_user and status<>''finished'') then raise exception ''execution_active''; end if;',
    'if exists(select 1 from public.submissions where user_id=p_user and status<>''finished'') then raise exception ''execution_active''; end if;'
    || E'\n '
    || 'if exists(select 1 from public.submissions where status<>''finished'') then raise exception ''executor_busy''; end if;'
  );
  if patched = definition then
    raise exception 'enqueue_submission_capacity_patch_not_applied';
  end if;
  execute patched;

  select pg_get_functiondef('public.claim_evaluation()'::regprocedure)
  into definition;
  patched := replace(
    definition,
    'if (select count(*) from private.jobs where lease_until>clock_timestamp())>=4 then return null; end if;',
    'if (select count(*) from private.jobs where lease_until>clock_timestamp())>=1 then return null; end if;'
  );
  if patched = definition then
    raise exception 'claim_evaluation_capacity_patch_not_applied';
  end if;
  execute patched;
end
$$;
