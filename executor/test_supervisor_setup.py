"""Tests only permission helpers on temporary paths, never runs user code."""
import os
from pathlib import Path
import tempfile
import unittest
from supervisor import restrict_postgres_socket

class SocketIsolationTests(unittest.TestCase):
    def test_template_excludes_local_reference_tests(self):
        dockerfile=(Path(__file__).parent/'Dockerfile').read_text()
        self.assertNotIn('COPY executor/*.py',dockerfile)
        self.assertNotIn('COPY executor/test_',dockerfile)
    def test_non_sql_denies_student_socket_and_sql_allows_traversal(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)/'socket';directory.mkdir()
            restrict_postgres_socket(directory,False,os.getuid())
            self.assertEqual(directory.stat().st_mode&0o777,0o700)
            restrict_postgres_socket(directory,True,os.getuid())
            self.assertEqual(directory.stat().st_mode&0o777,0o711)
    def test_rejects_wrong_owner_and_symlinks(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)/'socket';directory.mkdir()
            link=Path(temporary)/'link';link.symlink_to(directory)
            with self.assertRaises(RuntimeError):restrict_postgres_socket(directory,True,os.getuid()+1)
            with self.assertRaises(RuntimeError):restrict_postgres_socket(link,True,os.getuid())
if __name__=='__main__':unittest.main()
