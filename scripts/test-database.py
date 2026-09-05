#!/usr/bin/env python3
"""Local SQL invariant tests. Queue/cron/net doubles are explicitly NOT integration certification."""
from pathlib import Path
import subprocess
import time
import uuid

ROOT=Path(__file__).resolve().parents[1]
container='codegamer-sql-test-'+uuid.uuid4().hex[:10]
def docker(*args,input=None):
    return subprocess.run(['docker',*args],input=input,text=True,check=True,capture_output=True).stdout

bootstrap=r'''
create role anon;create role authenticated;create role service_role;
create schema auth;create table auth.users(id uuid primary key);
create schema extensions;create schema pgmq;create schema cron;create schema net;
create table pgmq.q_evaluations(msg_id bigserial primary key,message jsonb,vt timestamptz default now(),read_ct integer default 0);
create table pgmq.a_evaluations(msg_id bigint,message jsonb,archived_at timestamptz default now());
create table cron.job_run_details(end_time timestamptz);
create function pgmq.create(text) returns void language sql as $$ select; $$;
create function pgmq.send(text,jsonb) returns bigint language sql as $$ insert into pgmq.q_evaluations(message) values($2) returning msg_id; $$;
create function pgmq.read(text,integer,integer) returns table(msg_id bigint,read_ct integer,enqueued_at timestamptz,vt timestamptz,message jsonb) language sql as $$
 update pgmq.q_evaluations q set vt=clock_timestamp()+make_interval(secs=>$2),read_ct=q.read_ct+1
 where q.msg_id in(select z.msg_id from pgmq.q_evaluations z where z.vt<=clock_timestamp() order by z.msg_id limit $3 for update skip locked)
 returning q.msg_id,q.read_ct,now(),q.vt,q.message;
$$;
create function pgmq.archive(text,bigint) returns boolean language plpgsql as $$begin insert into pgmq.a_evaluations(msg_id,message) select msg_id,message from pgmq.q_evaluations where msg_id=$2;delete from pgmq.q_evaluations where msg_id=$2;return found;end$$;
create function pgmq.set_vt(text,bigint,integer) returns boolean language plpgsql as $$begin update pgmq.q_evaluations set vt=clock_timestamp()+make_interval(secs=>$3) where msg_id=$2;return found;end$$;
create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
'''
try:
    docker('run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine')
    for _ in range(60):
        try:docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres');break
        except subprocess.CalledProcessError:time.sleep(.2)
    migrations='\n'.join('\n'.join(line for line in p.read_text().splitlines() if not line.lower().startswith('create extension')) for p in sorted((ROOT/'supabase/migrations').glob('*.sql')))
    sql=bootstrap+'\n'+migrations+'\n'+(ROOT/'supabase/tests/invariants.sql').read_text()
    result=subprocess.run(['docker','exec','-i','-e','PGPASSWORD=local-test-only',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
    if result.returncode:print(result.stdout[-2000:]);print(result.stderr);raise SystemExit(result.returncode)
    print(result.stderr.strip());print('Local PostgreSQL invariant tests passed (PGMQ/cron/net doubled; run supabase test db for integration).')
finally:
    subprocess.run(['docker','rm','-f',container],capture_output=True)
