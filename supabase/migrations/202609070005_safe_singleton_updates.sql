-- Supabase's API role rejects UPDATE statements without a WHERE clause.
-- Rebuild the two existing functions with an explicit singleton predicate.
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
    'update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd;',
    'update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd where singleton;'
  );
  -- Fresh databases already receive the safe definition from the base
  -- migration. Existing beta databases need only this targeted rewrite.
  if patched <> definition then
    execute patched;
  end if;

  select pg_get_functiondef(
    'public.claim_evaluation()'::regprocedure
  ) into definition;
  patched := replace(
    definition,
    'update private.settings set credit_spent_usd=credit_spent_usd-job.reserved_usd;',
    'update private.settings set credit_spent_usd=credit_spent_usd-job.reserved_usd where singleton;'
  );
  patched := replace(
    patched,
    'update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd;',
    'update private.settings set credit_spent_usd=credit_spent_usd+cfg.cost_per_job_usd where singleton;'
  );
  patched := replace(
    patched,
    'update private.settings set last_sandbox_at=clock_timestamp();',
    'update private.settings set last_sandbox_at=clock_timestamp() where singleton;'
  );
  if patched <> definition then
    execute patched;
  end if;
end
$$;
