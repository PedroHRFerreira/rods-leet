import { MinHeap } from "./min-heap.ts";
import { shortestPath } from "./shortest-path.ts";

export function findMax(values: readonly number[]): number | null {
  if (!values.length) return null;
  let best = values[0];
  for (let index = 1; index < values.length; index++)
    if (values[index] > best) best = values[index];
  return best;
}

// Reference functions only consume private validated fixtures, never arbitrary student code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Heterogeneous private fixture dispatcher; each reference declares its own input contract.
export const referenceSolutions: Record<string, (input: any) => any> = {
  "find-max": findMax,
  "sum-even": (a: number[]) =>
    a.reduce((sum, n) => sum + (n % 2 === 0 ? n : 0), 0),
  "count-vowels": (s: string) =>
    [...s.toLowerCase()].filter((c) => "aeiou".includes(c)).length,
  "is-palindrome": (s: string) => {
    let a = 0,
      b = s.length - 1;
    const relevant = (c: string) => /[a-z0-9]/i.test(c);
    while (a < b) {
      while (a < b && !relevant(s[a])) a++;
      while (a < b && !relevant(s[b])) b--;
      if (s[a].toLowerCase() !== s[b].toLowerCase()) return false;
      a++;
      b--;
    }
    return true;
  },
  fizzbuzz: (n: number) =>
    Array.from(
      { length: n },
      (_, i) =>
        `${(i + 1) % 3 === 0 ? "Fizz" : ""}${(i + 1) % 5 === 0 ? "Buzz" : ""}` ||
        String(i + 1),
    ),
  "leap-year": (year: number) =>
    year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0),
  "digit-sum": (s: string) => {
    let sum = 0;
    for (const c of s) sum += Number(c);
    return sum === 0 ? 0 : 1 + ((sum - 1) % 9);
  },
  "interval-overlap": ({ a, b }: { a: number[]; b: number[] }) =>
    Math.max(a[0], b[0]) <= Math.min(a[1], b[1])
      ? [Math.max(a[0], b[0]), Math.min(a[1], b[1])]
      : null,
  "roman-numeral": (s: string) => {
    const values: Record<string, number> = {
      I: 1,
      V: 5,
      X: 10,
      L: 50,
      C: 100,
      D: 500,
      M: 1000,
    };
    let total = 0;
    for (let i = 0; i < s.length; i++)
      total +=
        values[s[i]] < (values[s[i + 1]] ?? 0) ? -values[s[i]] : values[s[i]];
    return total;
  },
  "expression-eval": (s: string) => {
    const numbers: number[] = [],
      operators: string[] = [];
    const precedence = (op: string) => (op === "*" ? 2 : op === "(" ? 0 : 1);
    const apply = () => {
      const b = numbers.pop()!,
        a = numbers.pop()!,
        op = operators.pop();
      numbers.push(op === "+" ? a + b : op === "-" ? a - b : a * b);
    };
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (c === " ") {
        i++;
        continue;
      }
      if (/\d/.test(c)) {
        let value = 0;
        while (i < s.length && /\d/.test(s[i]))
          value = value * 10 + Number(s[i++]);
        numbers.push(value);
        continue;
      }
      if (c === "(") operators.push(c);
      else if (c === ")") {
        while (operators.at(-1) !== "(") apply();
        operators.pop();
      } else {
        while (
          operators.length &&
          operators.at(-1) !== "(" &&
          precedence(operators.at(-1)!) >= precedence(c)
        )
          apply();
        operators.push(c);
      }
      i++;
    }
    while (operators.length) apply();
    return numbers[0];
  },
  "binary-search": ({
    values,
    target,
  }: {
    values: number[];
    target: number;
  }) => {
    let low = 0,
      high = values.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (values[middle] < target) low = middle + 1;
      else high = middle;
    }
    return values[low] === target ? low : -1;
  },
  "two-sum": ({ values, target }: { values: number[]; target: number }) => {
    const seen = new Map<number, number>();
    for (let j = 0; j < values.length; j++) {
      if (seen.has(target - values[j]))
        return [seen.get(target - values[j]), j];
      if (!seen.has(values[j])) seen.set(values[j], j);
    }
    return [];
  },
  "merge-sorted": ({ a, b }: { a: number[]; b: number[] }) => {
    const result: number[] = [];
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length)
      result.push(
        j >= b.length || (i < a.length && a[i] <= b[j]) ? a[i++] : b[j++],
      );
    return result;
  },
  "rotate-array": ({ values, k }: { values: number[]; k: number }) => {
    if (!values.length) return [];
    const offset = k % values.length;
    return values
      .slice(values.length - offset)
      .concat(values.slice(0, values.length - offset));
  },
  gcd: ([x, y]: number[]) => {
    let a = Math.abs(x),
      b = Math.abs(y);
    while (b) [a, b] = [b, a % b];
    return a;
  },
  "anagram-groups": (words: string[]) => {
    const groups = new Map<string, string[]>();
    for (const word of words) {
      const counts = new Array<number>(26).fill(0);
      for (const c of word) counts[c.charCodeAt(0) - 97]++;
      const key = counts.join(",");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(word);
    }
    return [...groups.values()];
  },
  "sliding-window-max": ({ values, k }: { values: number[]; k: number }) => {
    const queue: number[] = [],
      result: number[] = [];
    let head = 0;
    for (let i = 0; i < values.length; i++) {
      while (queue.length > head && queue[head] <= i - k) head++;
      while (
        queue.length > head &&
        values[queue[queue.length - 1]] <= values[i]
      )
        queue.pop();
      queue.push(i);
      if (i >= k - 1) result.push(values[queue[head]]);
      // Bound retained storage even on monotonically decreasing long inputs.
      if (head > k && head * 2 > queue.length) {
        queue.splice(0, head);
        head = 0;
      }
    }
    return result;
  },
  "longest-unique-substring": (s: string) => {
    const seen = new Map<string, number>();
    let left = 0,
      best = 0;
    for (let right = 0; right < s.length; right++) {
      left = Math.max(left, (seen.get(s[right]) ?? -1) + 1);
      seen.set(s[right], right);
      best = Math.max(best, right - left + 1);
    }
    return best;
  },
  "coin-change": ({ coins, amount }: { coins: number[]; amount: number }) => {
    const dp = Array<number>(amount + 1).fill(amount + 1);
    dp[0] = 0;
    for (let value = 1; value <= amount; value++)
      for (const coin of coins)
        if (coin <= value)
          dp[value] = Math.min(dp[value], 1 + dp[value - coin]);
    return dp[amount] > amount ? -1 : dp[amount];
  },
  "interval-merge": (input: number[][]) => {
    const intervals = input
        .map((x) => [...x])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      result: number[][] = [];
    for (const current of intervals) {
      const last = result.at(-1);
      if (last && last[1] >= current[0])
        last[1] = Math.max(last[1], current[1]);
      else result.push(current);
    }
    return result;
  },
  "topological-sort": ({ n, edges }: { n: number; edges: number[][] }) => {
    const graph: number[][] = Array.from({ length: n }, () => []),
      indegrees = Array<number>(n).fill(0),
      ready = new MinHeap<number>((a, b) => a - b),
      result: number[] = [];
    for (const [a, b] of edges) {
      graph[a].push(b);
      indegrees[b]++;
    }
    indegrees.forEach((count, v) => {
      if (!count) ready.push(v);
    });
    while (ready.size) {
      const v = ready.pop();
      result.push(v);
      for (const next of graph[v])
        if (--indegrees[next] === 0) ready.push(next);
    }
    return result.length === n ? result : [];
  },
  "shortest-path": ({ graph, start, end }) => shortestPath(graph, start, end),
  "edit-distance": ({ a, b }: { a: string; b: string }) => {
    if (b.length > a.length) [a, b] = [b, a];
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(
          next[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      previous = next;
    }
    return previous[b.length];
  },
  knapsack: ({
    weights,
    values,
    capacity,
  }: {
    weights: number[];
    values: number[];
    capacity: number;
  }) => {
    const dp = Array<number>(capacity + 1).fill(0);
    for (let i = 0; i < weights.length; i++)
      for (let cap = capacity; cap >= weights[i]; cap--)
        dp[cap] = Math.max(dp[cap], dp[cap - weights[i]] + values[i]);
    return dp[capacity];
  },
  "max-subarray": (values: number[]) => {
    let best = values[0],
      ending = values[0];
    for (let i = 1; i < values.length; i++) {
      ending = Math.max(values[i], ending + values[i]);
      best = Math.max(best, ending);
    }
    return best;
  },
  "stack-ops": (ops: Array<["push", number] | ["pop" | "peek"]>) => {
    const stack: number[] = [],
      results: Array<number | null> = [];
    for (const [op, value] of ops)
      if (op === "push") stack.push(value);
      else results.push((op === "pop" ? stack.pop() : stack.at(-1)) ?? null);
    return results;
  },
  "queue-ops": (ops: Array<["enqueue", number] | ["dequeue" | "peek"]>) => {
    const queue: number[] = [],
      results: Array<number | null> = [];
    let head = 0;
    for (const [op, value] of ops)
      if (op === "enqueue") queue.push(value);
      else {
        results.push(queue[head] ?? null);
        if (op === "dequeue" && head < queue.length) head++;
      }
    return results;
  },
  "balanced-brackets": (s: string) => {
    const stack: string[] = [];
    const pair: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const c of s) {
      if ("([{".includes(c)) stack.push(c);
      else if (stack.pop() !== pair[c]) return false;
    }
    return !stack.length;
  },
  "frequency-map": (words: string[]) => {
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    return [...counts.entries()];
  },
  "linked-list-reverse": ({ head, nodes }) => {
    const result = nodes.map(
      (node: { value: number; next: number | null }) => ({ ...node }),
    );
    let previous = null,
      current = head;
    while (current !== null) {
      const next = result[current].next;
      result[current].next = previous;
      previous = current;
      current = next;
    }
    return { head: previous, nodes: result };
  },
  "remove-duplicates": (values: number[]) => [...new Set(values)],
  "bst-search": ({ root, nodes, target }) => {
    let index = root;
    while (index !== null) {
      const node = nodes[index];
      if (node.value === target) return index;
      index = target < node.value ? node.left : node.right;
    }
    return null;
  },
  "tree-height": ({ root, nodes }) => {
    if (root === null) return 0;
    const stack: Array<[number, number]> = [[root, 1]];
    let best = 0;
    while (stack.length) {
      const [index, depth] = stack.pop()!;
      best = Math.max(best, depth);
      for (const child of [nodes[index].left, nodes[index].right])
        if (child !== null) stack.push([child, depth + 1]);
    }
    return best;
  },
  "level-order": ({ root, nodes }) => {
    if (root === null) return [];
    const queue = [root],
      levels: number[][] = [];
    let head = 0;
    while (head < queue.length) {
      const end = queue.length,
        level: number[] = [];
      while (head < end) {
        const node = nodes[queue[head++]];
        level.push(node.value);
        if (node.left !== null) queue.push(node.left);
        if (node.right !== null) queue.push(node.right);
      }
      levels.push(level);
    }
    return levels;
  },
  "lru-cache": ({ capacity, operations }) => {
    const cache = new Map<string, number>(),
      result: Array<number | null> = [];
    for (const [op, key, value] of operations) {
      if (op === "get") {
        const stored = cache.get(key);
        result.push(stored ?? null);
        if (cache.has(key)) {
          cache.delete(key);
          cache.set(key, stored!);
        }
      } else if (capacity > 0) {
        cache.delete(key);
        cache.set(key, value);
        if (cache.size > capacity) cache.delete(cache.keys().next().value!);
      }
    }
    return result;
  },
  "union-find": ({ n, operations }) => {
    const parent = Array.from({ length: n }, (_, i) => i),
      size = Array<number>(n).fill(1),
      result: boolean[] = [];
    const find = (node: number) => {
      while (node !== parent[node]) {
        parent[node] = parent[parent[node]];
        node = parent[node];
      }
      return node;
    };
    for (const [op, a, b] of operations) {
      let x = find(a),
        y = find(b);
      if (op === "connected") result.push(x === y);
      else if (x !== y) {
        if (size[x] < size[y]) [x, y] = [y, x];
        parent[y] = x;
        size[x] += size[y];
      }
    }
    return result;
  },
  "trie-prefix": ({
    words,
    prefixes,
  }: {
    words: string[];
    prefixes: string[];
  }) => {
    interface Node {
      count: number;
      children: Map<string, Node>;
    }
    const root: Node = { count: 0, children: new Map() };
    for (const word of new Set(words)) {
      let node = root;
      node.count++;
      for (const c of word) {
        if (!node.children.has(c))
          node.children.set(c, { count: 0, children: new Map() });
        node = node.children.get(c)!;
        node.count++;
      }
    }
    return prefixes.map((prefix) => {
      let node: Node | undefined = root;
      for (const c of prefix) node = node?.children.get(c);
      return node?.count ?? 0;
    });
  },
  "range-sum": ({ values, operations }) => {
    const a: number[] = [...values],
      tree = Array<number>(a.length + 1).fill(0),
      result: number[] = [];
    const add = (index: number, delta: number) => {
      for (let i = index + 1; i < tree.length; i += i & -i) tree[i] += delta;
    };
    const prefix = (index: number) => {
      let total = 0;
      for (let i = index + 1; i > 0; i -= i & -i) total += tree[i];
      return total;
    };
    a.forEach((v, i) => add(i, v));
    for (const [op, x, y] of operations)
      if (op === "set") {
        add(x, y - a[x]);
        a[x] = y;
      } else result.push(prefix(y) - prefix(x - 1));
    return result;
  },
  "median-stream": (values: number[]) => {
    const lower = new MinHeap<number>((a, b) => b - a),
      upper = new MinHeap<number>((a, b) => a - b),
      result: number[] = [];
    for (const value of values) {
      if (!lower.size || value <= lower.peek()) lower.push(value);
      else upper.push(value);
      if (lower.size > upper.size + 1) upper.push(lower.pop());
      if (upper.size > lower.size) lower.push(upper.pop());
      result.push(
        lower.size === upper.size
          ? (lower.peek() + upper.peek()) / 2
          : lower.peek(),
      );
    }
    return result;
  },
  "heap-top-k": ({ values, k }: { values: number[]; k: number }) => {
    if (!k) return [];
    const heap = new MinHeap<number>((a, b) => a - b);
    for (const value of values) {
      if (heap.size < k) heap.push(value);
      else if (value > heap.peek()) {
        heap.pop();
        heap.push(value);
      }
    }
    const result: number[] = [];
    while (heap.size) result.push(heap.pop());
    return result.reverse();
  },
};
