#!/usr/bin/env python3
"""Trusted root-owned supervisor. Requires delegated cgroup v2; fails closed.

Never execute this program against user code on the host. It belongs only inside
an ephemeral, network-isolated E2B VM built from the reviewed runtime template.
"""
import hashlib
import json
import os
from pathlib import Path
import pwd
import resource
import selectors
import signal
import stat
import subprocess
import sys
import time
import uuid

ROOT = Path('/opt/codegamer')
WORK = Path('/workspace')
CONTROL = Path('/run/codegamer')
CGROOT = Path('/sys/fs/cgroup/codegamer')
OUTPUT_LIMIT = 65536
JOB_LIMIT = 262144

def protected(path):
    info = path.stat()
    if info.st_uid != 0 or info.st_mode & 0o022:
        raise RuntimeError('unprotected_control_file')

def restrict_postgres_socket(directory, is_sql, owner_uid):
    """Non-SQL programs cannot offload work to the separately supervised DB."""
    info=directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=owner_uid:
        raise RuntimeError('unprotected_postgres_socket')
    os.chmod(directory,0o711 if is_sql else 0o700)

def run_limited(command, stdin, wall, cpu, memory=1024**3, sql=False):
    """Bound total descendants via cgroup, not only the initial process PID."""
    if os.geteuid() != 0 or not (CGROOT / 'cgroup.controllers').exists():
        raise RuntimeError('cgroup_v2_required')
    group = CGROOT / uuid.uuid4().hex
    group.mkdir()
    (group / 'memory.max').write_text(str(memory))
    (group / 'memory.swap.max').write_text('0')
    (group / 'pids.max').write_text('64')
    (group / 'cpu.max').write_text('200000 100000')
    student = pwd.getpwnam('student')
    def drop():
        (group / 'cgroup.procs').write_text(str(os.getpid()))
        os.setsid()
        os.setgroups([])
        os.setgid(student.pw_gid)
        os.setuid(student.pw_uid)
        resource.setrlimit(resource.RLIMIT_FSIZE, (16*1024**2,16*1024**2))
        resource.setrlimit(resource.RLIMIT_NOFILE,(128,128))
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        # Prevent regaining privilege through setuid binaries.
        import ctypes
        if ctypes.CDLL(None).prctl(38,1,0,0,0) != 0:
            os._exit(125)
    started = time.monotonic()
    pg_group=Path('/sys/fs/cgroup/codegamer-postgres')
    def pg_cpu():
        return int(dict(line.split() for line in (pg_group/'cpu.stat').read_text().splitlines()).get('usage_usec',0)) if sql else 0
    pg_initial=pg_cpu()
    process = None
    output = bytearray()
    error_output = bytearray()
    termination = 'ok'
    cpu_us = 0
    try:
        process = subprocess.Popen(command, cwd=WORK, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env={'PATH':'/usr/local/bin:/usr/bin:/bin:/opt/dotnet:/opt/go/bin:/opt/kotlin/bin', 'HOME':'/workspace',
                 'LANG':'C.UTF-8', 'TMPDIR':'/workspace/tmp','DOTNET_CLI_HOME':'/workspace','DOTNET_NOLOGO':'1',
                 'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_SKIP_FIRST_TIME_EXPERIENCE':'1','GOTOOLCHAIN':'local','CARGO_HOME':'/opt/cargo'}, preexec_fn=drop)
        for pipe in (process.stdin,process.stdout,process.stderr): os.set_blocking(pipe.fileno(),False)
        selector=selectors.DefaultSelector()
        selector.register(process.stdout,selectors.EVENT_READ,output)
        selector.register(process.stderr,selectors.EVENT_READ,error_output)
        pending=memoryview(stdin.encode())
        selector.register(process.stdin,selectors.EVENT_WRITE,'stdin')
        while True:
            elapsed=time.monotonic()-started
            stats=dict(line.split() for line in (group/'cpu.stat').read_text().splitlines())
            cpu_us=int(stats.get('usage_usec',0))+pg_cpu()-pg_initial
            if elapsed>wall or cpu_us>cpu*1_000_000: termination='time_limit';break
            if len(output)+len(error_output)>OUTPUT_LIMIT: termination='output_limit';break
            for key,_ in selector.select(0.005):
                if key.data=='stdin':
                    try:
                        size=os.write(key.fd,pending[:8192])
                        pending=pending[size:]
                    except BrokenPipeError: pending=memoryview(b'')
                    if not pending: selector.unregister(key.fileobj);key.fileobj.close()
                else:
                    data=os.read(key.fd,4096)
                    if data:key.data.extend(data)
                    else:selector.unregister(key.fileobj)
            if len(output)+len(error_output)>OUTPUT_LIMIT:termination='output_limit';break
            if process.poll() is not None and not selector.get_map():break
        events=dict(line.split() for line in (group/'memory.events').read_text().splitlines())
        if sql:
            pg_events=dict(line.split() for line in (pg_group/'memory.events').read_text().splitlines())
            if int(pg_events.get('oom_kill',0))>0:termination='memory_limit'
        if int(events.get('oom_kill',0))>0:termination='memory_limit'
        if termination=='ok' and process.poll()!=0:termination='runtime_error'
        peak=int((group/'memory.peak').read_text())+(int((pg_group/'memory.peak').read_text()) if sql else 0)
        return {'termination':termination,'stdout':output[:OUTPUT_LIMIT].decode('utf-8','replace'),
                'stderr':error_output[:OUTPUT_LIMIT].decode('utf-8','replace'),
                'metrics':{'cpuMs':cpu_us/1000,'wallMs':(time.monotonic()-started)*1000,'peakMemoryKiB':peak//1024}}
    finally:
        # This kills descendants even after setsid, daemonization or parent exit.
        (group/'cgroup.kill').write_text('1')
        if process is not None:
            process.wait(timeout=2)
            for pipe in (process.stdin,process.stdout,process.stderr):
                if pipe and not pipe.closed:pipe.close()
        for _ in range(100):
            try:group.rmdir();break
            except OSError:time.sleep(0.01)

def main():
    protected(ROOT/'manifest.json');protected(ROOT/'supervisor.py');protected(ROOT/'adapters.py')
    sys.path.insert(0,str(ROOT))
    from adapters import prepare
    request_path=CONTROL/'request.json';protected(request_path)
    request=json.loads(request_path.read_text())
    digest=hashlib.sha256((ROOT/'manifest.json').read_bytes()).hexdigest()
    if request['manifestSha256']!=digest:raise RuntimeError('manifest_mismatch')
    manifest=json.loads((ROOT/'manifest.json').read_text())
    if request['languageId'] not in manifest['languages']:raise RuntimeError('runtime_unavailable')
    if request['functionName'] not in ('solve','findMax','shortestPath','sql'):raise RuntimeError('invalid_entrypoint')
    restrict_postgres_socket(Path('/run/postgresql'),request['languageId']=='sql',pwd.getpwnam('postgres').pw_uid)
    CONTROL.mkdir(mode=0o700,exist_ok=True)
    WORK.mkdir(mode=0o755,exist_ok=True);(WORK/'tmp').mkdir(exist_ok=True)
    student=pwd.getpwnam('student')
    os.chown(WORK,student.pw_uid,student.pw_gid);os.chown(WORK/'tmp',student.pw_uid,student.pw_gid)
    command,compile_command=prepare(request,manifest)
    if compile_command:
        compilation=run_limited(compile_command,'',45,40)
        if compilation['termination']!='ok':
            verdict='compile_error' if compilation['termination']=='runtime_error' else compilation['termination']
            (CONTROL/'result.json').write_text(json.dumps({'termination':verdict,'cases':[],'compilation':compilation}))
            return
    cases=[];total=0;job_start=time.monotonic()
    for case in request['cases']:
        if time.monotonic()-job_start>35:
            (CONTROL/'result.json').write_text(json.dumps({'termination':'time_limit','cases':cases}))
            return
        if request['languageId']=='sql':
            # Only trusted generated fixtures can reach this privileged connection.
            import psycopg
            with psycopg.connect('host=/run/postgresql dbname=codegamer user=root') as database:
                database.execute('DROP SCHEMA IF EXISTS challenge CASCADE; CREATE SCHEMA challenge AUTHORIZATION root; SET search_path=challenge,pg_catalog',prepare=False)
                database.execute(case['input']['schema'],prepare=False)
                database.execute(case['input']['seedSql'],prepare=False)
                database.execute('GRANT USAGE ON SCHEMA challenge TO cg_student; GRANT SELECT ON ALL TABLES IN SCHEMA challenge TO cg_student',prepare=False)
        result=run_limited(command,json.dumps(case['input'],separators=(',',':'))+'\n',5,2,sql=request['languageId']=='sql')
        total+=len(result['stdout'].encode())+len(result['stderr'].encode())
        if total>JOB_LIMIT:result['termination']='output_limit';result['stdout']='';result['stderr']=''
        cases.append(result)
        if result['termination']!='ok':break
    (CONTROL/'result.json').write_text(json.dumps({'termination':'ok','cases':cases}))

if __name__=='__main__':
    try:main()
    except Exception as exc:
        # Operational codes only; never dump a request or student source to logs.
        CONTROL.mkdir(mode=0o700,exist_ok=True)
        (CONTROL/'result.json').write_text(json.dumps({'termination':'infrastructure_error','code':type(exc).__name__,'cases':[]}))
        sys.exit(1)
