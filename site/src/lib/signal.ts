// A tiny reactive value: the whole state layer the site needs (docs/site_plan.md §3).

export interface Signal<T> {
  get(): T;
  set(value: T): void;
  /** Calls `fn` now and on every change; returns an unsubscribe function. */
  subscribe(fn: (value: T) => void): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const fn of subs) fn(value);
    },
    subscribe(fn) {
      subs.add(fn);
      fn(value);
      return () => subs.delete(fn);
    },
  };
}
