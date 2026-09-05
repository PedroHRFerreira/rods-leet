import unittest
import ast
from pathlib import Path
import re
from sql_policy import validate_query
class SqlPolicyTests(unittest.TestCase):
    def test_all_published_reference_queries_pass_policy(self):
        source=(Path(__file__).resolve().parents[1]/'judge/sql.ts').read_text().split('};',1)[0]
        values=re.findall(r'''["']sql-[^"']+["']\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,''',source)
        self.assertEqual(len(values),10)
        for literal in values:self.assertTrue(validate_query(ast.literal_eval(literal)))
    def test_reads(self):
        for sql in ['SELECT id FROM players WHERE id > 1','WITH x AS (SELECT id FROM players) SELECT count(*) FROM x','SELECT name, dense_rank() OVER (ORDER BY points DESC) FROM players','SELECT CAST(sum(points) AS bigint) FROM players']:
            self.assertTrue(validate_query(sql))
    def test_forbidden(self):
        for sql in ['SELECT 1; DELETE FROM players','WITH x AS (DELETE FROM players RETURNING *) SELECT * FROM x','SELECT * INTO copied FROM players','SELECT pg_read_file(\'/etc/passwd\')','SELECT pg_catalog.pg_sleep(10)','SELECT * FROM pg_catalog.pg_authid','SELECT * FROM pg_authid','SELECT * FROM pg_class','SELECT * FROM missing_relation','SELECT \'pg_authid\'::regclass','SELECT * FROM players FOR UPDATE','SET statement_timeout=0','SELECT set_config(\'x\',\'y\',false)','SELECT * FROM pg_class WHERE EXISTS (WITH pg_class AS (SELECT id FROM players) SELECT * FROM pg_class)']:
            with self.subTest(sql=sql),self.assertRaises((ValueError,Exception)):validate_query(sql)
if __name__=='__main__':unittest.main()
