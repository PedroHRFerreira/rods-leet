"""Runs repository-authored reference code only, in disposable local folders."""
import json
import ast
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
import adapters

ROOT=Path(__file__).resolve().parents[1]
TSC=ROOT/'node_modules/.bin/tsc'

@unittest.skipUnless(TSC.exists() and shutil.which('node'),'Node and project TypeScript are required')
class TypeScriptAdapterTests(unittest.TestCase):
    def execute_reference(self,files,name,value):
        with tempfile.TemporaryDirectory(prefix='codegamer-reference-') as directory:
            work=Path(directory);original=adapters.WORK;adapters.WORK=work
            try:
                for path,source in files.items():(work/path).write_text(source)
                command,compile_command=adapters.prepare({'languageId':'typescript','functionName':name},{})
                compile_command[0]=str(TSC)
                compile_command=[str(work) if part=='/workspace' else part for part in compile_command]
                subprocess.run(compile_command,cwd=work,check=True,capture_output=True,text=True,timeout=15)
                process=subprocess.run(command,cwd=work,input=json.dumps(value),check=True,capture_output=True,text=True,timeout=5)
                self.assertLess(len(process.stdout.encode()),65536)
                return json.loads(process.stdout)
            finally:adapters.WORK=original
    def test_multifile_dijkstra_module_resolution(self):
        source=(ROOT/'judge/editorial-sources.ts').read_text()
        def literal(name):
            match=re.search(r'''export const '''+name+r'''\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*;''',source)
            self.assertIsNotNone(match, f'Missing reference export: {name}')
            return ast.literal_eval(match.group(1))
        value={'graph':[[{'to':1,'weight':4},{'to':2,'weight':1}],[{'to':3,'weight':1}],[{'to':1,'weight':2},{'to':3,'weight':5}],[]],'start':0,'end':3}
        self.assertEqual(self.execute_reference({'solution.ts':literal('shortestPathSource'),'min-heap.ts':literal('heapSource')},'shortestPath',value),[0,2,1,3])
    def test_max_100000_compact_output(self):
        source='export function findMax(values: readonly number[]): number | null {if(!values.length)return null;let best=values[0];for(let i=1;i<values.length;i++)if(values[i]>best)best=values[i];return best;}'
        self.assertEqual(self.execute_reference({'solution.ts':source},'findMax',list(range(100000))),{'result':99999,'inputUnchanged':True})
if __name__=='__main__':unittest.main()
