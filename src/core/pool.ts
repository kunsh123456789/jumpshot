/**
 * Fixed-capacity object pool with a dense active list. Objects are
 * preallocated; acquire/release never allocate. Iterate `items[0..count)`.
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;
  constructor(factory: () => T, readonly capacity: number) {
    for (let i = 0; i < capacity; i++) this.items.push(factory());
  }
  /** Returns a recycled object, or steals the oldest one if the pool is full. */
  acquire(): T {
    if (this.count < this.capacity) return this.items[this.count++];
    // Full: recycle slot 0 (oldest-ish) by rotating it to the end.
    const it = this.items[0];
    this.items.copyWithin(0, 1);
    this.items[this.capacity - 1] = it;
    return it;
  }
  /** Release by index (swap-remove). Caller must not advance index after release. */
  releaseAt(i: number): void {
    const last = --this.count;
    if (i !== last) {
      const tmp = this.items[i];
      this.items[i] = this.items[last];
      this.items[last] = tmp;
    }
  }
  clear(): void { this.count = 0; }
}
