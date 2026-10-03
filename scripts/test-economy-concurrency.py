#!/usr/bin/env python3
"""Exercise economy races in disposable PostgreSQL; never connects to production."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = "rods-economy-races-" + uuid.uuid4().hex[:10]
USER = "60000000-0000-4000-8000-000000000001"


def docker(*args, **kwargs):
    return subprocess.run(["docker", *args], text=True, capture_output=True, **kwargs)


def sql(statement, check=True):
    result = docker("exec", "-i", "-e", "PGPASSWORD=local-test-only", CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres",
                    "-v", "ON_ERROR_STOP=1", "-At", input=statement)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result


def race(statements):
    with ThreadPoolExecutor(max_workers=len(statements)) as pool:
        return list(pool.map(lambda statement: sql(statement, check=False), statements))


def check_wallet(expected_coins, expected_hints):
    actual = sql(f"select coins||':'||hint_balance from public.profiles where id='{USER}';").stdout.strip()
    assert actual == f"{expected_coins}:{expected_hints}", actual
    assert sql(f"select coins=sum(amount) from public.profiles p join public.coin_ledger l on l.user_id=p.id where p.id='{USER}' group by p.coins;").stdout.strip() == "t"


try:
    started = docker("run", "--rm", "-d", "--name", CONTAINER,
                     "-e", "POSTGRES_PASSWORD=local-test-only", "postgres:16-alpine")
    if started.returncode:
        raise RuntimeError(started.stderr)
    for _ in range(100):
        if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres").returncode == 0:
            break
        time.sleep(0.1)
    bootstrap = re.search(r"bootstrap=r'''(.*?)'''", (ROOT / "scripts/test-database.py").read_text(), re.S).group(1)
    migrations = "\n".join("\n".join(line for line in path.read_text().splitlines()
                                     if not line.lower().startswith("create extension"))
                           for path in sorted((ROOT / "supabase/migrations").glob("*.sql")))
    sql(bootstrap + "\n" + migrations)
    sql(f"""
        insert into auth.users(id,is_anonymous) values('{USER}',false);
        select public.admit_user('{USER}','','Concurrency test');
        select private.credit_coins('{USER}','test-funding',300);
    """)
    results = race([f"select public.shop_purchase('{USER}','hint-pack3','same-key',75);" for _ in range(8)])
    assert all(result.returncode == 0 for result in results), [r.stderr for r in results]
    check_wallet(225, 4)
    print("PASS concurrent same-key pack: one debit and one grant")

    # Every request has a different key: the wallet must still prevent overspending.
    sql(f"select private.credit_coins('{USER}','test-drain',-150);")
    results = race([f"select public.shop_purchase('{USER}','hint-pack3','independent-{i}',75);" for i in range(8)])
    assert sum(result.returncode == 0 for result in results) == 1
    assert all(result.returncode == 0 or "insufficient_coins" in result.stderr for result in results)
    check_wallet(0, 7)
    print("PASS concurrent different keys: no negative wallet or uncharged hints")

    sql(f"select private.credit_coins('{USER}','cosmetic-funding',500);")
    price = int(sql("select coalesce((select (value->>'price')::integer from jsonb_array_elements(private.shop_offers(now())) where value->>'itemId'='avatar-robot'),100);").stdout.strip())
    results = race([f"select public.shop_purchase('{USER}','avatar-robot','cosmetic-{i}',{price});" for i in range(8)])
    assert all(result.returncode == 0 for result in results), [r.stderr for r in results]
    check_wallet(500 - price, 7)
    assert sql(f"select count(*) from public.inventory where user_id='{USER}' and item_id='avatar-robot';").stdout.strip() == "1"
    print("PASS concurrent permanent item: one charge and one inventory entry")

    # Official events and completions in a finished week; schedule and catch-up race.
    helper = (ROOT / "tests/fixtures/shop-rewards-v2.sql").read_text().split("do $$", 1)[0]
    helper = helper.replace("begin;", "", 1).replace("pg_temp.complete_study", "private.concurrency_complete")
    sql(helper)
    sql(f"""
        update private.settings set shop_rewards_started_at=private.study_week(now())-interval '7 days';
        insert into private.runtimes(language_id,runtime_version) values('v2-test','test');
        insert into public.challenge_versions(id,challenge_id,difficulty,base_xp,definition,published) values('v2-test:v1','v2-test','easy',150,'{{}}',true);
        select private.concurrency_complete('{USER}','race-week-'||i,private.study_week(now())-interval '6 days',100) from generate_series(1,3) i;
    """)
    before = int(sql(f"select coins from public.profiles where id='{USER}';").stdout.strip())
    results = race(["select private.close_due_study_weeks();" for _ in range(8)])
    assert all(result.returncode == 0 for result in results), [r.stderr for r in results]
    check_wallet(before + 500, 7)
    assert sql("select count(*) from private.weekly_results;").stdout.strip() == "1"
    assert sql(f"select count(*) from public.coin_ledger where user_id='{USER}' and source like 'ranking:weekly:%';").stdout.strip() == "1"
    assert sql(f"select count(*) from public.inventory where user_id='{USER}' and item_id='frame-champion';").stdout.strip() == "1"
    print("PASS concurrent scheduled close and recovery: one podium, prize and frame")
    print("Real PostgreSQL races passed; queue/cron/net are doubles, not extension integration.")
finally:
    docker("rm", "-f", CONTAINER)
