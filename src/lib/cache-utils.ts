/**
 * Prune a timestamped cache Map to stay within maxSize.
 * Removes stale entries first (older than ttlMs), then evicts oldest
 * insertion-order entries if still over the limit.
 */
export function pruneCache<T extends { timestamp: number }>(
  cache: Map<string, T>,
  maxSize: number,
  ttlMs: number
): void {
  if (cache.size <= maxSize) return;

  const now = Date.now();

  // Pass 1: remove entries older than TTL
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > ttlMs) {
      cache.delete(key);
    }
  }

  // Pass 2: if still over, evict oldest (Maps iterate in insertion order)
  if (cache.size > maxSize) {
    const excess = cache.size - maxSize;
    const keys = cache.keys();
    for (let i = 0; i < excess; i++) {
      const key = keys.next().value;
      if (key !== undefined) cache.delete(key);
    }
  }
}
