import { MinHeap } from "./min-heap.ts";

export type Graph = ReadonlyArray<
  ReadonlyArray<{ to: number; weight: number }>
>;
export interface PathInput {
  graph: Graph;
  start: number;
  end: number;
}

export function shortestPath(
  graph: Graph,
  start: number,
  end: number,
): number[] {
  const distance = Array<number>(graph.length).fill(Infinity);
  const previous = Array<number>(graph.length).fill(-1);
  const heap = new MinHeap<[number, number]>((a, b) => a[0] - b[0]);
  distance[start] = 0;
  heap.push([0, start]);
  while (heap.size) {
    const [cost, vertex] = heap.pop();
    if (cost !== distance[vertex]) continue;
    if (vertex === end) break;
    for (const { to, weight } of graph[vertex]) {
      const candidate = cost + weight;
      if (candidate < distance[to]) {
        distance[to] = candidate;
        previous[to] = vertex;
        heap.push([candidate, to]);
      }
    }
  }
  if (distance[end] === Infinity) return [];
  const path: number[] = [];
  for (let vertex = end; vertex !== -1; vertex = previous[vertex])
    path.push(vertex);
  return path.reverse();
}

export function pathCost(input: PathInput, path: unknown): number | null {
  if (
    !Array.isArray(path) ||
    !path.every((v) => Number.isInteger(v) && v >= 0 && v < input.graph.length)
  )
    return null;
  if (!path.length) return Infinity;
  if (path[0] !== input.start || path[path.length - 1] !== input.end)
    return null;
  // Restrict to a simple path. Removing nonnegative cycles never worsens a shortest path.
  if (new Set(path).size !== path.length) return null;
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    let weight = Infinity;
    for (const edge of input.graph[path[i - 1]])
      if (edge.to === path[i]) weight = Math.min(weight, edge.weight);
    if (!Number.isFinite(weight)) return null;
    cost += weight;
  }
  return cost;
}

/** Expected is a trusted reference path; equal-cost alternatives are accepted. */
export function comparePath(
  input: PathInput,
  expected: unknown,
  actual: unknown,
): boolean {
  const expectedCost = pathCost(input, expected),
    actualCost = pathCost(input, actual);
  return (
    expectedCost !== null && actualCost !== null && expectedCost === actualCost
  );
}
