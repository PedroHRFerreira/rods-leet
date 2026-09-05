"""PostgreSQL 18 AST policy. Never replace this with a regex-only SQL filter."""
import json
from pglast import parser

FUNCTIONS = {'count','sum','avg','min','max','coalesce','nullif','abs','round','ceil','ceiling','floor',
    'lower','upper','length','char_length','substring','trim','btrim','ltrim','rtrim','concat','concat_ws',
    'row_number','rank','dense_rank','lag','lead','first_value','last_value','nth_value','ntile',
    'greatest','least','array_agg','string_agg','bool_and','bool_or','date_part','date_trunc'}
TYPES = {'int2','int4','int8','integer','smallint','bigint','numeric','decimal','float4','float8',
    'real','double precision','text','varchar','bpchar','bool','boolean','date','timestamp','timestamptz','interval'}
OPERATORS = {'+','-','*','/','%','=','<>','!=','<','>','<=','>=','||','~~','!~~','~~*','!~~*'}

def names(parts):
    return [part.get('String',{}).get('sval','') for part in parts or []]

def validate_query(sql, allowed_relations=None):
    if len(sql.encode())>262144:raise ValueError('query_too_large')
    parsed=json.loads(parser.parse_sql_json(sql))
    statements=parsed.get('stmts',[])
    if len(statements)!=1 or 'SelectStmt' not in statements[0].get('stmt',{}):raise ValueError('read_only_query_required')
    relations=set(allowed_relations or {'players','scores','orders','customers','employees'})
    def walk(value, ctes=frozenset()):
        if isinstance(value,list):
            for child in value:walk(child,ctes)
        elif isinstance(value,dict):
            for key,node in value.items():
                if key.endswith('Stmt') and key!='SelectStmt':raise ValueError('write_statement_forbidden')
                if key=='SelectStmt' and (node.get('intoClause') or node.get('lockingClause')):raise ValueError('select_into_or_lock_forbidden')
                if key=='SelectStmt':
                    local={cte['CommonTableExpr']['ctename'] for cte in node.get('withClause',{}).get('ctes',[])}
                    walk(node,ctes|local)
                    continue
                if key=='RangeVar' and (node.get('catalogname') or node.get('schemaname') not in (None,'challenge')):raise ValueError('schema_forbidden')
                if key=='RangeVar' and node.get('relname') not in (relations|ctes):raise ValueError('relation_forbidden')
                if key=='FuncCall':
                    parts=names(node.get('funcname'))
                    if len(parts)>2 or (len(parts)==2 and parts[0]!='pg_catalog') or not parts or parts[-1].lower() not in FUNCTIONS:raise ValueError('function_forbidden')
                if key in ('TypeName','typeName'):
                    parts=names(node.get('names'))
                    if len(parts)>2 or (len(parts)==2 and parts[0]!='pg_catalog') or not parts or parts[-1].lower() not in TYPES:raise ValueError('cast_forbidden')
                if key=='A_Expr':
                    parts=names(node.get('name'))
                    if len(parts)>1 or any(part not in OPERATORS for part in parts):raise ValueError('operator_forbidden')
                if key in ('SQLValueFunction','RangeFunction','TableFunc','XmlExpr','JsonTable','CurrentOfExpr'):raise ValueError('expression_forbidden')
                walk(node,ctes)
    walk(statements[0]['stmt'])
    return True
