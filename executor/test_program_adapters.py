"""Validate trusted command construction only; never execute student source."""
from pathlib import Path
import tempfile
import unittest
import adapters


class ProgramAdapterTests(unittest.TestCase):
    def test_all_languages_run_source_without_function_adapter(self):
        languages=('javascript','typescript','python','java','csharp','cpp','c','go','rust','kotlin')
        with tempfile.TemporaryDirectory() as directory:
            original=adapters.WORK
            try:
                for language in languages:
                    work=Path(directory)/language;work.mkdir();adapters.WORK=work
                    command,compile_command=adapters.prepare({'languageId':language,'functionName':'solve','executionMode':'program'},{})
                    self.assertTrue(command)
                    self.assertEqual(compile_command is None,language in ('javascript','python'))
                    for path in work.iterdir():
                        text=path.read_text()
                        self.assertNotIn('student.solve',text)
                        self.assertNotIn('Solution.solve',text)
                    self.assertFalse((work/'adapter.mjs').exists())
                    self.assertFalse((work/'Main.java').exists())
                    self.assertFalse((work/'adapter.py').exists())
            finally:adapters.WORK=original

    def test_default_remains_function_and_sql_stays_restricted(self):
        with tempfile.TemporaryDirectory() as directory:
            original=adapters.WORK;adapters.WORK=Path(directory)
            try:
                command,_=adapters.prepare({'languageId':'javascript','functionName':'solve'},{})
                self.assertIn('adapter.mjs',command)
                sql,_=adapters.prepare({'languageId':'sql','functionName':'sql','executionMode':'program'},{})
                self.assertEqual(sql[-1],'/opt/codegamer/sql_runner.py')
            finally:adapters.WORK=original


if __name__=='__main__':unittest.main()
