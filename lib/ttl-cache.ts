// A few seconds of memory for lookups that every request repeats (the restaurant row, the Super Admin's switches, the
// plan state). The database is a network hop away, so asking once per few seconds instead of once per request is the
// biggest speed-up we have. Any write to those tables clears it at once (see db() in db/store.ts), and a short life
// keeps other server instances close behind.
// Kept on globalThis: the server builds each API route as its own bundle, and without this every route would keep a
// separate copy, so a write in one route would not clear what another route remembers.
const g = globalThis as unknown as { __tsTtl?: Map<string, { exp: number; p: Promise<unknown> }> };
const store = (g.__tsTtl ??= new Map());

export function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.p as Promise<T>;
  if (store.size > 500) store.clear();
  const p = fn();
  store.set(key, { exp: now + ms, p });
  // A failed lookup is never remembered.
  p.catch(() => {
    if (store.get(key)?.p === p) store.delete(key);
  });
  return p;
}

export function bustCache() {
  store.clear();
}
