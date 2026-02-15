/**
 * Prune a timestamped cache Map to stay within maxSize.
 * Removes stale entries first (older than ttlMs), then evicts oldest.
 */
export function pruneCache<T extends { timestamp: number }>(
  cache: Map<string, T>,
  maxSize: number,
  ttlMs: number
): void {
  if (cache.size <= maxSize) return;

  const now = Date.now();

  for (const [key, entry] of cache) {
    if (now - entry.timestamp > ttlMs) {
      cache.delete(key);
    }
  }

  if (cache.size > maxSize) {
    const excess = cache.size - maxSize;
    const keys = cache.keys();
    for (let i = 0; i < excess; i++) {
      const key = keys.next().value;
      if (key !== undefined) cache.delete(key);
    }
  }
}
