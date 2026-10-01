"""Runtime SQL serialization regressions without executing submitted SQL on the host."""
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import MagicMock, patch


class SqlEncodingTests(unittest.TestCase):
    def test_connection_requests_utf8_and_preserves_accents_and_null(self):
        connection = MagicMock()
        cursor = MagicMock()
        cursor.description = [SimpleNamespace(name="name", type_code=25), SimpleNamespace(name="city", type_code=25)]
        cursor.__iter__.return_value = iter([("João", "São Luís"), ("Ana", None)])
        connection.__enter__.return_value = connection
        connection.cursor.return_value.__enter__.return_value = cursor
        connect = MagicMock(return_value=connection)
        modules = {"psycopg": SimpleNamespace(connect=connect), "sql_policy": SimpleNamespace(validate_query=MagicMock())}
        with patch.dict(sys.modules, modules):
            spec = importlib.util.spec_from_file_location("encoding_sql_runner", Path(__file__).with_name("sql_runner.py"))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        fake_file = SimpleNamespace(read_text=lambda: "SELECT name, city FROM customers;")
        output = io.StringIO()
        with patch.object(module, "Path", return_value=fake_file), patch.object(sys, "stdin", io.StringIO('{"allowedRelations":["customers"]}')), patch.object(sys, "stdout", output):
            module.main()
        self.assertEqual(connect.call_args.kwargs["client_encoding"], "UTF8")
        result = json.loads(output.getvalue())
        self.assertEqual(result["rows"], [["João", "São Luís"], ["Ana", None]])
        self.assertEqual(result["columns"], [{"name": "name", "type": "text"}, {"name": "city", "type": "text"}])
        self.assertEqual(connection.execute.call_args_list[0].args[0], "BEGIN READ ONLY")
        module.validate_query.assert_called_once_with("SELECT name, city FROM customers;", {"customers"})


if __name__ == "__main__":
    unittest.main()
