#!/usr/bin/env python3
import json
from pathlib import Path
import sys
sys.path.insert(0,'/opt/codegamer')
from sql_policy import validate_query
import psycopg

def main():
    query=Path('/workspace/solution.sql').read_text()
    # Peer mapping permits UID student to connect only as cg_student.
    with psycopg.connect('host=/run/postgresql dbname=codegamer user=cg_student',connect_timeout=2) as connection:
        tables={row[0] for row in connection.execute("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='challenge'")}
        validate_query(query,tables)
        connection.execute('BEGIN READ ONLY')
        connection.execute("SET LOCAL search_path=challenge,pg_catalog")
        connection.execute("SET LOCAL statement_timeout='4000ms'")
        connection.execute("SET LOCAL lock_timeout='100ms'")
        connection.execute("SET LOCAL idle_in_transaction_session_timeout='5000ms'")
        with connection.cursor() as cursor:
            cursor.execute(query,prepare=False)
            types={20:'int8',23:'int4',25:'text',21:'int2',1700:'numeric',701:'float8',16:'bool'}
            columns=[{'name':column.name,'type':types.get(column.type_code,str(column.type_code))} for column in cursor.description]
            rows=[];size=0
            for row in cursor:
                size+=len(json.dumps(row,default=str).encode())
                if size>60000:raise ValueError('output_limit')
                rows.append(list(row))
            print(json.dumps({'columns':columns,'rows':rows},default=str,separators=(',',':')))
        connection.rollback()

if __name__=='__main__':main()
