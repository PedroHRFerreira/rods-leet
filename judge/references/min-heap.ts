/** Trusted editorial implementation. Never expose before solution unlock. */
export class MinHeap<T> {
  private items: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}
  get size(): number { return this.items.length; }
  peek(): T { if (!this.size) throw new Error('Fila vazia'); return this.items[0]; }
  push(item: T): void {
    const a = this.items;
    let index = a.push(item) - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(a[parent], a[index]) <= 0) break;
      [a[parent], a[index]] = [a[index], a[parent]];
      index = parent;
    }
  }
  pop(): T {
    if (!this.size) throw new Error('Fila vazia');
    const a = this.items, first = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let index = 0;
      while (2 * index + 1 < a.length) {
        let child = 2 * index + 1;
        if (child + 1 < a.length && this.compare(a[child + 1], a[child]) < 0) child++;
        if (this.compare(a[index], a[child]) <= 0) break;
        [a[index], a[child]] = [a[child], a[index]];
        index = child;
      }
    }
    return first;
  }
}
