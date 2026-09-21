/**
 * Small in-process LRU cache where concurrent callers for the same key share one computation.
 * Port of app/backend/cache.py's SharedCache — no thread lock needed here: JS's single-threaded
 * event loop means "coalesce concurrent callers" just means "cache the in-flight Promise".
 */
export class SharedCache<K, V> {
  private readonly maxsize: number
  private readonly values = new Map<K, V>()
  private readonly inflight = new Map<K, Promise<V>>()

  constructor(maxsize: number) {
    this.maxsize = maxsize
  }

  async get(key: K, compute: () => Promise<V>): Promise<V> {
    const cached = this.values.get(key)
    if (cached !== undefined) {
      // Refresh recency (LRU): re-insert so it sorts last in Map's iteration order
      this.values.delete(key)
      this.values.set(key, cached)
      return cached
    }

    const existing = this.inflight.get(key)
    if (existing) return existing

    const promise = compute()
    this.inflight.set(key, promise)
    try {
      const value = await promise
      this.values.set(key, value)
      while (this.values.size > this.maxsize) {
        const oldest = this.values.keys().next().value as K
        this.values.delete(oldest)
      }
      return value
    } finally {
      // Exceptions propagate and nothing is cached, matching cache.py
      this.inflight.delete(key)
    }
  }
}
