begin;

alter table private.settings drop constraint if exists settings_cost_per_job_usd_check;
alter table private.settings add constraint settings_cost_per_job_usd_check check (cost_per_job_usd >= 0);

update private.settings
set cost_per_job_usd = 0,
    confirmed_credit_usd = 0,
    credit_spent_usd = 0,
    execution_enabled = false;

comment on column private.settings.cost_per_job_usd is
  'Reserved provider cost per job. Zero is valid for the owner-operated local beta executor.';

commit;
