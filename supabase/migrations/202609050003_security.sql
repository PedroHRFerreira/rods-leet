-- Durable BFF state; browser roles cannot read ciphertext, nonces or counters.
create table private.bff_sessions (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in ('session','oauth')),
 payload text not null check(length(payload)<=24576),
 version bigint not null default 1,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 touched_at timestamptz not null default now(),
 lock_owner uuid, lock_until timestamptz
);
create table private.bff_nonces(nonce text primary key, expires_at timestamptz not null);
create table private.security_rates(bucket text primary key, started_at timestamptz not null, count integer not null);
create table private.request_bindings(user_id uuid not null, key text not null, operation text not null, digest text not null, created_at timestamptz not null default now(), primary key(user_id,key));
revoke all on private.bff_sessions,private.bff_nonces,private.security_rates,private.request_bindings from public,anon,authenticated;

create function public.bff_nonce(p_nonce text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_nonce !~ '^[a-f0-9-]{32,128}$' then return false; end if;
 insert into private.bff_nonces values(p_nonce,now()+interval '2 minutes') on conflict do nothing;
 return found;
end $$;
create function public.security_rate(p_bucket text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if length(p_bucket)>160 or p_limit<1 or p_limit>120 or p_seconds<1 or p_seconds>3600 then raise exception 'invalid_rate'; end if;
 insert into private.security_rates values(p_bucket,now(),1)
 on conflict(bucket) do update set
 count=case when private.security_rates.started_at+make_interval(secs=>p_seconds)<=now() then 1 else private.security_rates.count+1 end,
 started_at=case when private.security_rates.started_at+make_interval(secs=>p_seconds)<=now() then now() else private.security_rates.started_at end
 returning count into n;
 return n<=p_limit;
end $$;
create function public.bind_request(p_user uuid,p_key text,p_operation text,p_digest text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.request_bindings;
begin
 if length(p_key)>128 or length(p_operation)>400 or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'invalid_idempotency_key'; end if;
 insert into private.request_bindings(user_id,key,operation,digest) values(p_user,p_key,p_operation,p_digest) on conflict do nothing;
 select * into r from private.request_bindings where user_id=p_user and key=p_key;
 if r.operation<>p_operation or r.digest<>p_digest then raise exception 'idempotency_conflict'; end if;
end $$;
create function public.bff_session(p_op text,p_id text,p_payload text default null,p_version bigint default null,p_owner uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.bff_sessions; owner uuid;
begin
 if p_id !~ '^[a-f0-9]{64}$' then raise exception 'invalid_id'; end if;
 if p_op in ('create','oauth-put') then
  if p_payload is null or length(p_payload)=0 or length(p_payload)>24576 then raise exception 'invalid_payload'; end if;
  insert into private.bff_sessions(id,kind,payload,expires_at) values(p_id,case when p_op='create' then 'session' else 'oauth' end,p_payload,now()+case when p_op='create' then interval '24 hours' else interval '10 minutes' end) returning * into s;
 else
  select * into s from private.bff_sessions where id=p_id for update;
  if not found then return null; end if;
  if p_op='delete' then delete from private.bff_sessions where id=p_id; return null; end if;
  if s.expires_at<=now() or (s.kind='session' and s.touched_at+interval '2 hours'<=now()) then delete from private.bff_sessions where id=p_id; return null; end if;
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
revoke all on function public.bff_nonce(text),public.security_rate(text,integer,integer),public.bind_request(uuid,text,text,text),public.bff_session(text,text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.bff_nonce(text),public.security_rate(text,integer,integer),public.bind_request(uuid,text,text,text),public.bff_session(text,text,text,bigint,uuid) to service_role;
-- Bounded retention. Request bindings persist alongside business idempotency records.
select cron.schedule('security-state-cleanup','*/10 * * * *',$job$
 delete from private.bff_nonces where expires_at<now();
 delete from private.security_rates where started_at<now()-interval '1 hour';
 delete from private.bff_sessions where expires_at<now() or (kind='session' and touched_at<now()-interval '2 hours');
$job$);
