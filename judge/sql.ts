import type { SqlColumn, SqlResult } from './comparators.ts';

export const sqlReferenceQueries: Record<string, string> = {
  'sql-active-orders': "SELECT id, amount FROM orders WHERE status = 'paid' AND amount >= 100 ORDER BY id;",
  'sql-customer-count': 'SELECT city, COUNT(*) AS total FROM customers GROUP BY city ORDER BY city NULLS LAST;',
  'sql-order-owner': 'SELECT o.id, c.name AS customer_name, o.amount FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.id;',
  'sql-no-orders': 'SELECT c.id, c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id) ORDER BY c.id;',
  'sql-customer-spend': "SELECT c.id AS customer_id, COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'paid'), 0) AS total_paid FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY total_paid DESC, customer_id;",
  'sql-above-average': 'SELECT id, name, department FROM employees e WHERE salary > (SELECT AVG(salary) FROM employees p WHERE p.department = e.department) ORDER BY id;',
  'sql-second-salary': 'WITH ranked AS (SELECT department, salary, DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS position FROM employees) SELECT department, MAX(salary) FILTER (WHERE position = 2) AS second_salary FROM ranked GROUP BY department ORDER BY department;',
  'sql-running-score': 'SELECT id, player_id, SUM(points) OVER (PARTITION BY player_id ORDER BY played_on, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_points FROM scores ORDER BY player_id, played_on, id;',
  'sql-top-players': 'WITH totals AS (SELECT p.id AS player_id, p.name, COALESCE(SUM(s.points), 0) AS total_points FROM players p LEFT JOIN scores s ON s.player_id = p.id GROUP BY p.id, p.name), ranked AS (SELECT *, DENSE_RANK() OVER (ORDER BY total_points DESC) AS position FROM totals) SELECT player_id, name, total_points, position FROM ranked WHERE position <= 3 ORDER BY position, player_id;',
  'sql-reporting-tree': 'WITH RECURSIVE hierarchy AS (SELECT id, name, 0 AS depth FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, h.depth + 1 FROM employees e JOIN hierarchy h ON e.manager_id = h.id) SELECT id, name, depth FROM hierarchy ORDER BY depth, id;',
};

interface Customer { id: number; name: string; city: string | null }
interface Order { id: number; customer_id: number | null; amount: number; status: string; created_at: string }
interface Employee { id: number; name: string; department: string; salary: number; manager_id: number | null }
interface Player { id: number; name: string }
interface Score { id: number; player_id: number; points: number; played_on: string }
interface Dataset { customers: Customer[]; orders: Order[]; employees: Employee[]; players: Player[]; scores: Score[] }

function dataset(seed: number): Dataset {
  if (seed === 2) return { customers: [], orders: [], employees: [], players: [], scores: [] };
  const offset = seed * 100, id = (n: number) => n + offset;
  return {
    customers: [
      { id: id(1), name: `Ana${seed}`, city: 'Recife' }, { id: id(2), name: `Bia${seed}`, city: 'Recife' },
      { id: id(3), name: `Caio${seed}`, city: null }, { id: id(4), name: `Dora${seed}`, city: 'Natal' },
      { id: id(5), name: `Eva${seed}`, city: null },
    ],
    orders: [
      { id: id(1), customer_id: id(1), amount: 100 + seed, status: 'paid', created_at: '2026-01-01' },
      { id: id(2), customer_id: id(1), amount: 99, status: 'paid', created_at: '2026-01-02' },
      { id: id(3), customer_id: id(2), amount: 500, status: 'pending', created_at: '2026-01-03' },
      { id: id(4), customer_id: null, amount: 250, status: 'paid', created_at: '2026-01-03' },
      { id: id(5), customer_id: id(3), amount: 199 + seed, status: 'paid', created_at: '2026-01-05' },
      { id: id(6), customer_id: id(4), amount: 0, status: 'cancelled', created_at: '2026-01-07' },
    ],
    employees: [
      { id: id(1), name: `Ana${seed}`, department: 'Eng', salary: 300 + seed, manager_id: null },
      { id: id(2), name: `Bia${seed}`, department: 'Eng', salary: 300 + seed, manager_id: id(1) },
      { id: id(3), name: `Caio${seed}`, department: 'Eng', salary: 100 + seed, manager_id: id(2) },
      { id: id(4), name: `Dora${seed}`, department: 'Ops', salary: 90, manager_id: null },
      { id: id(5), name: `Eva${seed}`, department: 'Ops', salary: 90, manager_id: id(4) },
      { id: id(6), name: `Fábio${seed}`, department: 'Design', salary: 80, manager_id: id(2) },
    ],
    players: Array.from({ length: 6 }, (_, i) => ({ id: id(i + 1), name: `Player${seed}-${i + 1}` })),
    scores: [
      { id: id(1), player_id: id(1), points: 50 + seed, played_on: '2026-01-02' },
      { id: id(2), player_id: id(1), points: 50, played_on: '2026-01-02' },
      { id: id(3), player_id: id(2), points: 100 + seed, played_on: '2026-01-03' },
      { id: id(4), player_id: id(3), points: 70, played_on: '2026-01-01' },
      { id: id(5), player_id: id(4), points: 10, played_on: '2026-01-01' },
      { id: id(6), player_id: id(5), points: -5, played_on: '2026-01-01' },
      { id: id(7), player_id: id(1), points: 0, played_on: '2026-01-01' },
    ],
  };
}

function literal(value: unknown): string { return value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`; }
function insert(table: string, rows: object[]): string {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${rows.map(row => '(' + columns.map(key => literal((row as Record<string, unknown>)[key])).join(', ') + ')').join(',\n')};`;
}
const column = (name: string, type: SqlColumn['type']): SqlColumn => ({ name, type });

function expected(id: string, d: Dataset): SqlResult {
  switch (id) {
    case 'sql-active-orders': return { columns: [column('id', 'int4'), column('amount', 'int4')], rows: d.orders.filter(o => o.status === 'paid' && o.amount >= 100).sort((a, b) => a.id - b.id).map(o => [o.id, o.amount]) };
    case 'sql-customer-count': {
      const groups = new Map<string | null, number>(); for (const customer of d.customers) groups.set(customer.city, (groups.get(customer.city) ?? 0) + 1);
      return { columns: [column('city', 'text'), column('total', 'int8')], rows: [...groups].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : a.localeCompare(b)) };
    }
    case 'sql-order-owner': return { columns: [column('id', 'int4'), column('customer_name', 'text'), column('amount', 'int4')], rows: d.orders.map(o => [o.id, d.customers.find(c => c.id === o.customer_id)?.name ?? null, o.amount]) };
    case 'sql-no-orders': return { columns: [column('id', 'int4'), column('name', 'text')], rows: d.customers.filter(c => !d.orders.some(o => o.customer_id === c.id)).map(c => [c.id, c.name]) };
    case 'sql-customer-spend': return { columns: [column('customer_id', 'int4'), column('total_paid', 'int8')], rows: d.customers.map(c => [c.id, d.orders.filter(o => o.customer_id === c.id && o.status === 'paid').reduce((sum, o) => sum + o.amount, 0)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]) };
    case 'sql-above-average': return { columns: [column('id', 'int4'), column('name', 'text'), column('department', 'text')], rows: d.employees.filter(e => { const peers = d.employees.filter(p => p.department === e.department); return e.salary * peers.length > peers.reduce((sum, p) => sum + p.salary, 0); }).map(e => [e.id, e.name, e.department]) };
    case 'sql-second-salary': {
      const departments = [...new Set(d.employees.map(e => e.department))].sort();
      return { columns: [column('department', 'text'), column('second_salary', 'int4')], rows: departments.map(department => [department, [...new Set(d.employees.filter(e => e.department === department).map(e => e.salary))].sort((a, b) => b - a)[1] ?? null]) };
    }
    case 'sql-running-score': {
      const totals = new Map<number, number>();
      return { columns: [column('id', 'int4'), column('player_id', 'int4'), column('running_points', 'int8')], rows: [...d.scores].sort((a, b) => a.player_id - b.player_id || a.played_on.localeCompare(b.played_on) || a.id - b.id).map(s => { const total = (totals.get(s.player_id) ?? 0) + s.points; totals.set(s.player_id, total); return [s.id, s.player_id, total]; }) };
    }
    case 'sql-top-players': {
      const totals = d.players.map(p => ({ ...p, total: d.scores.filter(s => s.player_id === p.id).reduce((sum, s) => sum + s.points, 0) })), distinct = [...new Set(totals.map(p => p.total))].sort((a, b) => b - a);
      return { columns: [column('player_id', 'int4'), column('name', 'text'), column('total_points', 'int8'), column('position', 'int8')], rows: totals.map(p => [p.id, p.name, p.total, distinct.indexOf(p.total) + 1]).filter(row => Number(row[3]) <= 3).sort((a, b) => Number(a[3]) - Number(b[3]) || Number(a[0]) - Number(b[0])) };
    }
    case 'sql-reporting-tree': {
      return { columns: [column('id', 'int4'), column('name', 'text'), column('depth', 'int4')], rows: d.employees.map(e => { let depth = 0, manager = e.manager_id; while (manager !== null) { depth++; manager = d.employees.find(p => p.id === manager)!.manager_id; } return [e.id, e.name, depth]; }).sort((a, b) => Number(a[2]) - Number(b[2]) || Number(a[0]) - Number(b[0])) };
    }
    default: throw new Error(`Consulta sem perfil: ${id}`);
  }
}

export interface SqlFixture { input: { schema: string; seedSql: string; ordered: true }; expected: SqlResult; public: boolean }
export function sqlFixtures(challengeId: string, schema: string, examples: Array<{ input: unknown }> = []): SqlFixture[] {
  const create = (d: Dataset, isPublic: boolean): SqlFixture => {
    const tables = schema.includes('customers') ? ['customers', 'orders'] : schema.includes('employees') ? ['employees'] : ['players', 'scores'];
    return { input: { schema, seedSql: tables.map(table => insert(table, d[table as keyof Dataset])).join('\n'), ordered: true }, expected: expected(challengeId, d), public: isPublic };
  };
  const publicCases = examples.map(example => {
    const input = example.input as Record<string, Record<string, unknown>[]>;
    const d = dataset(2);
    d.customers = (input.customers ?? []).map((row, i) => ({ id: i + 1, name: `Cliente ${i + 1}`, city: null, ...row }) as unknown as Customer);
    d.orders = (input.orders ?? []).map((row, i) => ({ id: i + 1, customer_id: null, amount: 0, status: 'paid', created_at: '2026-01-01', ...row }) as unknown as Order);
    d.employees = (input.employees ?? []).map((row, i) => ({ id: i + 1, name: `Pessoa ${i + 1}`, department: 'Eng', salary: 0, manager_id: null, ...row }) as unknown as Employee);
    d.players = (input.players ?? []).map((row, i) => ({ id: i + 1, name: `Player ${i + 1}`, ...row }) as unknown as Player);
    d.scores = (input.scores ?? []).map((row, i) => ({ id: i + 1, player_id: 1, points: 0, played_on: '2026-01-01', ...row }) as unknown as Score);
    for (const score of d.scores) if (!d.players.some(player => player.id === score.player_id)) d.players.push({ id: score.player_id, name: `Player ${score.player_id}` });
    return create(d, true);
  });
  return [...publicCases, ...[0, 1, 2].map(seed => create(dataset(seed), false))];
}
