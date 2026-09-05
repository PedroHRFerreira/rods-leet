"""Root-owned compiler commands and JSON adapters; no source-derived shell command."""
import json
import os
from pathlib import Path
import pwd

WORK=Path('/workspace')
def write(path,content):
    target=WORK/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content)
    os.chmod(target,0o444)

def prepare(request,manifest):
    language=request['languageId']; name=request['functionName']; maximum=name=='findMax'
    if language=='sql':
        return ['/opt/python/bin/python3','-I','/opt/codegamer/sql_runner.py'],None
    if language in ('javascript','typescript'):
        module='./solution.js'
        call='student.findMax(input)' if maximum else 'student.shortestPath(input.graph,input.start,input.end)' if name=='shortestPath' else 'student.solve(input)'
        write('package.json','{"type":"commonjs"}' if language=='typescript' else '{"type":"module"}')
        write('adapter.mjs',f'''import * as student from {json.dumps(module)};
import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(0,'utf8'));const original=JSON.stringify(input);
const result={call};
console.log(JSON.stringify({"{result,inputUnchanged:JSON.stringify(input)===original}" if maximum else "result"}));
''')
        compile_command=['/usr/local/bin/tsc','solution.ts','--outDir','/workspace','--target','ES2022','--module','commonjs','--moduleResolution','node','--skipLibCheck'] if language=='typescript' else None
        return ['node','--max-old-space-size=1024','adapter.mjs'],compile_command
    if language=='python':
        call='student.find_max(value)' if maximum else 'student.solve(value)'
        write('adapter.py',f'''import sys,json
sys.path.insert(0,'/workspace')
import solution as student
value=json.load(sys.stdin); original=json.dumps(value,separators=(',',':'));result={call}
print(json.dumps({"{'result':result,'inputUnchanged':json.dumps(value,separators=(',',':'))==original}" if maximum else "result"},separators=(',',':')))
''')
        return ['/opt/python/bin/python3','-I','adapter.py'],None
    if language=='java':
        call='int[] values=mapper.treeToValue(input,int[].class); int[] original=values.clone(); Integer result=Solution.findMax(values); var out=mapper.createObjectNode();out.set("result",mapper.valueToTree(result));out.put("inputUnchanged",java.util.Arrays.equals(values,original));System.out.println(out);' if maximum else 'System.out.println(mapper.writeValueAsString(Solution.solve(input)));'
        write('Main.java','import com.fasterxml.jackson.databind.*; public class Main { public static void main(String[] args) throws Exception { var mapper=new ObjectMapper();JsonNode input=mapper.readTree(System.in);'+call+'}}')
        return ['java','-Xmx1024m','-cp','.:/opt/libs/*','Main'],['javac','-cp','/opt/libs/*','Main.java','Solution.java']
    if language=='csharp':
        call='var values=System.Text.Json.JsonSerializer.Deserialize<int[]>(input!.ToJsonString())!;var original=(int[])values.Clone();var result=Solution.FindMax(values);System.Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {result,inputUnchanged=System.Linq.Enumerable.SequenceEqual(values,original)}));' if maximum else 'System.Console.WriteLine(Solution.Solve(input)?.ToJsonString() ?? "null");'
        write('Main.cs','using System.Text.Json.Nodes; var input=JsonNode.Parse(System.Console.In.ReadToEnd());'+call)
        write('CodeGamer.csproj','<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Main.cs"/><Compile Include="Solution.cs"/></ItemGroup></Project>')
        return ['dotnet','bin/Release/net8.0/CodeGamer.dll'],['dotnet','build','CodeGamer.csproj','-c','Release','--ignore-failed-sources','--nologo']
    if language=='cpp':
        call='auto values=input.get<std::vector<int>>();auto original=values;auto result=find_max(values);nlohmann::json out={{"result",result?nlohmann::json(*result):nlohmann::json(nullptr)},{"inputUnchanged",values==original}};std::cout<<out;' if maximum else 'std::cout<<solve(input);'
        write('adapter.cpp','#include <iostream>\n#include <nlohmann/json.hpp>\n#include "solution.cpp"\nint main(){nlohmann::json input;std::cin>>input;'+call+'}')
        return ['./program'],['g++','-std=c++20','-O2','adapter.cpp','-o','program']
    if language=='c':
        call='int count=cJSON_GetArraySize(input);int *values=calloc(count?count:1,sizeof(int));int *original=calloc(count?count:1,sizeof(int));for(int i=0;i<count;i++)values[i]=original[i]=cJSON_GetArrayItem(input,i)->valueint;MaxResult r=find_max(values,count);cJSON *out=cJSON_CreateObject();cJSON_AddItemToObject(out,"result",r.present?cJSON_CreateNumber(r.value):cJSON_CreateNull());cJSON_AddBoolToObject(out,"inputUnchanged",memcmp(values,original,count*sizeof(int))==0);free(values);free(original);' if maximum else 'cJSON *out=solve(input);'
        write('adapter.c','#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <cjson/cJSON.h>\n#include "solution.c"\nint main(){size_t n=0,cap=1024;char *buf=malloc(cap);int ch;while((ch=getchar())!=EOF){if(n+1>=cap){cap*=2;buf=realloc(buf,cap);}buf[n++]=ch;}buf[n]=0;cJSON *input=cJSON_Parse(buf);'+call+'char *text=cJSON_PrintUnformatted(out);puts(text?text:"null");free(text);cJSON_Delete(out);cJSON_Delete(input);free(buf);}')
        return ['./program'],['gcc','-std=c17','-O2','adapter.c','-lcjson','-o','program']
    if language=='go':
        source=(WORK/'solution.go').read_text();write('solution/solution.go',source);write('go.mod','module codegamer\n\ngo 1.23\n')
        call='var values []int;json.Unmarshal(data,&values);original:=append([]int(nil),values...);n,present:=solution.FindMax(values);var result any;if present{result=n};unchanged:=len(values)==len(original);for i:=range values{if values[i]!=original[i]{unchanged=false}};json.NewEncoder(os.Stdout).Encode(map[string]any{"result":result,"inputUnchanged":unchanged})' if maximum else 'var input any;json.Unmarshal(data,&input);json.NewEncoder(os.Stdout).Encode(solution.Solve(input))'
        write('main.go','package main\nimport("encoding/json";"os";"io";"codegamer/solution")\nfunc main(){data,_:=io.ReadAll(os.Stdin);'+call+'}')
        return ['./program'],['go','build','-o','program','main.go']
    if language=='rust':
        write('Cargo.toml','[package]\nname="codegamer"\nversion="0.1.0"\nedition="2021"\n[[bin]]\nname="program"\npath="main.rs"\n[dependencies]\nserde_json="=1.0.140"\n')
        call='let values:Vec<i32>=serde_json::from_value(input).unwrap();let original=values.clone();let result=solution::find_max(&values);println!("{}",serde_json::json!({"result":result,"inputUnchanged":values==original}));' if maximum else 'println!("{}",solution::solve(input));'
        write('main.rs','mod solution;use std::io::{self,Read};fn main(){let mut text=String::new();io::stdin().read_to_string(&mut text).unwrap();let input:serde_json::Value=serde_json::from_str(&text).unwrap();'+call+'}')
        return ['target/release/program'],['cargo','build','--offline','--release']
    if language=='kotlin':
        call='val values=input.jsonArray.map { it.jsonPrimitive.int }.toIntArray();val original=values.clone();val result=findMax(values);println(buildJsonObject{put("result",result?.let{JsonPrimitive(it)}?:JsonNull);put("inputUnchanged",values.contentEquals(original))})' if maximum else 'println(solve(input))'
        write('Main.kt','import kotlinx.serialization.json.*\nfun main(){val input=Json.parseToJsonElement(System.`in`.bufferedReader().readText());'+call+'}')
        return ['java','-Xmx1024m','-cp','program.jar:/opt/kotlin-libs/*','MainKt'],['kotlinc','Solution.kt','Main.kt','-classpath','/opt/kotlin-libs/kotlinx-serialization-json-jvm.jar:/opt/kotlin-libs/kotlinx-serialization-core-jvm.jar','-include-runtime','-d','program.jar']
    raise RuntimeError('unsupported_language')
