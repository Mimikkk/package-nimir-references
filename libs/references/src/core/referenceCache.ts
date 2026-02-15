import type { AdapterCache } from '../adapters/adapterCache.ts';

/**
 * Reason why an ID is negatively cached.
 *
 * This is used to avoid repeatedly fetching IDs that are known to be unavailable.
 */
export type NegativeReason = 'not-found' | 'unauthorized' | 'missing' | 'internal-server-error';

/**
 * A cached "negative" entry (represents an ID that should resolve to `null` for some time).
 */
export interface NegativeEntry {
  /**
   * Reason for the negative cache entry.
   */
  reason: NegativeReason;

  /**
   * Epoch milliseconds when this entry expires.
   */
  expiry: number;
}

/**
 * A cached "positive" entry (represents a resolved resource).
 */
export interface PositiveEntry<TResource> {
  resource: TResource;

  /**
   * Epoch milliseconds when the resource was stored.
   */
  updatedAt: number;
}

/**
 * Cache entry stored by `ReferenceCache`.
 */
export type ResourceEntry<TResource> = PositiveEntry<TResource> | NegativeEntry;

const NegativePrefix = 'neg:';
const prefixNegative = (id: string) => `${NegativePrefix}${id}`;

export class ReferenceCache<TResource> {
  private constructor(private readonly cache: AdapterCache<ResourceEntry<TResource>>) {}

  /**
   * Wraps an adapter implementation into a cache used by stores.
   */
  static new<TResource>(cache: AdapterCache<ResourceEntry<TResource>>): ReferenceCache<TResource> {
    return new ReferenceCache(cache);
  }

  /**
   * Loads the whole cache (adapter `entries()`), partitions into positive/negative and filters by TTL.
   *
   * This is primarily used by the `fetchAll` strategy to warm up quickly.
   */
  async all(ttlMs: number): Promise<{ positive: Map<string, TResource>; negative: Map<string, NegativeEntry> }> {
    const entries = await this.cache.entries();
    const positive = new Map<string, TResource>();
    const negative = new Map<string, NegativeEntry>();
    const now = Date.now();

    for (const [key, value] of entries) {
      if (key.startsWith(NegativePrefix)) {
        const entry = value as NegativeEntry;
        if (now < entry.expiry) {
          negative.set(key.slice(NegativePrefix.length), entry);
        }
        continue;
      }

      const entry = value as PositiveEntry<TResource>;
      if (now - entry.updatedAt <= ttlMs) {
        positive.set(key, entry.resource);
      }
    }

    return { positive, negative };
  }

  async positives(ids: string[], ttlMs: number): Promise<Map<string, TResource>> {
    if (ids.length === 0) return new Map();

    const now = Date.now();
    const expiredIds: string[] = [];
    const entries = await this.cache.getMany(ids);
    const result = new Map<string, TResource>();

    for (let i = 0; i < ids.length; ++i) {
      const entry = entries[i] as PositiveEntry<TResource> | undefined;
      if (!entry) continue;

      if (now - entry.updatedAt > ttlMs) {
        expiredIds.push(ids[i]);
        continue;
      }

      result.set(ids[i], entry.resource);
    }

    if (expiredIds.length > 0) {
      await this.cache.delMany(expiredIds);
    }

    return result;
  }

  async negatives(ids: string[]): Promise<Map<string, NegativeEntry>> {
    if (ids.length === 0) return new Map();

    const now = Date.now();
    const expiredIds: string[] = [];
    const keys = ids.map(prefixNegative);
    const entries = await this.cache.getMany(keys);
    const result = new Map<string, NegativeEntry>();

    for (let i = 0; i < ids.length; i++) {
      const entry = entries[i] as NegativeEntry | undefined;
      if (!entry) continue;

      if (now >= entry.expiry) {
        expiredIds.push(keys[i]);
      } else {
        result.set(ids[i], entry);
      }
    }

    if (expiredIds.length > 0) {
      await this.cache.delMany(expiredIds);
    }

    return result;
  }

  /**
   * Stores resources as positive entries, with a shared `updatedAt` timestamp.
   */
  async storePositives(items: [id: string, data: TResource][]): Promise<void> {
    if (items.length === 0) return;
    const now = Date.now();

    await this.cache.setMany(
      items.map(([id, data]): [string, PositiveEntry<TResource>] => [id, { resource: data, updatedAt: now }]),
    );
  }

  /**
   * Stores negative entries for IDs (all share the same expiry).
   */
  async storeNegatives(ids: string[], reason: NegativeReason, ttlMs: number): Promise<void> {
    if (ids.length === 0) return;

    const expiry = Date.now() + ttlMs;
    const entry: NegativeEntry = { reason, expiry };
    await this.cache.setMany(ids.map(id => [prefixNegative(id), entry]));
  }

  /**
   * Removes both positive and negative entries for the given IDs.
   */
  async removeByIds(ids: string[]): Promise<void> {
    await this.cache.delMany(ids.concat(ids.map(prefixNegative)));
  }

  /**
   * Clears all cache entries.
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }
}
