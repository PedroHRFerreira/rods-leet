begin;

insert into private.runtimes(language_id,runtime_version,template_id,manifest_sha256,homologated)
values
  ('python','3.11','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('javascript','22.14.0','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('typescript','5.9.3','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('java','17','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('csharp','8.0.407','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('cpp','C++20','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('c','C17','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('go','1.23.7','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('rust','1.85.0','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('kotlin','2.1.10','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true),
  ('sql','18','local-docker-v1','86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc',true)
on conflict(language_id) do update set
  runtime_version=excluded.runtime_version,
  template_id=excluded.template_id,
  manifest_sha256=excluded.manifest_sha256,
  homologated=excluded.homologated;

do $$
begin
  if (select count(*) from private.runtimes where homologated) <> 11 then
    raise exception 'runtime_homologation_incomplete';
  end if;
end;
$$;

alter table public.submissions alter column provider set default 'local';

update private.settings
set cost_per_job_usd = 0,
    confirmed_credit_usd = 0,
    credit_spent_usd = 0,
    execution_enabled = coordinator_url is not null and coordinator_secret is not null;

commit;
