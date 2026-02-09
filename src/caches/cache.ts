import {
  createStore,
  delMany,
  get,
  getMany,
  clear as idbClear,
  del as idbDel,
  entries as idbEntries,
  keys as idbKeys,
  values as idbValues,
  set,
  setMany,
  type UseStore,
} from 'idb-keyval';

export interface Cache<TValue> {
  get(key: string): Promise<TValue | null>;
  getMany(keys: string[]): Promise<TValue[]>;
  entries(): Promise<[string, TValue][]>;
  values(): Promise<TValue[]>;
  keys(): Promise<string[]>;
  set(key: string, item: TValue): Promise<void>;
  setMany(entries: [key: string, item: TValue][]): Promise<void>;
  del(key: string): Promise<void>;
  delMany(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

export class IndexDbCache<TValue> implements Cache<TValue> {
  private constructor(private readonly store: UseStore) {}

  static fromNames<T>(database: string, store: string): IndexDbCache<T> {
    return new IndexDbCache(createStore(database, store));
  }

  async values(): Promise<TValue[]> {
    return await idbValues<TValue>(this.store);
  }

  async keys(): Promise<string[]> {
    return await idbKeys<string>(this.store);
  }

  async entries(): Promise<[string, TValue][]> {
    return await idbEntries(this.store);
  }

  async get(key: string): Promise<TValue | null> {
    const entry = await get<TValue>(key, this.store);
    return entry ?? null;
  }

  async getMany(keys: string[]): Promise<TValue[]> {
    return await getMany<TValue>(keys, this.store);
  }

  async set(key: string, item: TValue): Promise<void> {
    await set(key, item, this.store);
  }

  async setMany(entries: [key: string, item: TValue][]): Promise<void> {
    await setMany(entries, this.store);
  }

  async del(key: string): Promise<void> {
    await idbDel(key, this.store);
  }

  async delMany(keys: string[]): Promise<void> {
    await delMany(keys, this.store);
  }

  async clear(): Promise<void> {
    await idbClear(this.store);
  }
}

export class ResourceCache<TResource> {
  private constructor(private readonly cache: Cache<CacheEntry<TResource>>) {}

  public static fromCache<TResource>(cache: Cache<CacheEntry<TResource>>): ResourceCache<TResource> {
    return new ResourceCache(cache);
  }

  async all(ttlMs: number): Promise<{ positive: Map<string, TResource>; negative: Map<string, NegativeEntry> }> {
    const entries = await this.cache.entries();
    const positive = new Map<string, TResource>();
    const negative = new Map<string, NegativeEntry>();
    const now = Date.now();

    for (const [key, value] of entries) {
      if (key.startsWith(NegativePrefix)) {
        const entry = value as unknown as NegativeEntry;
        if (now < entry.expiry) {
          negative.set(key.slice(NegativePrefix.length), entry);
        }
      } else {
        const entry = value as PositiveEntry<TResource>;
        if (now - entry.updatedAt <= ttlMs) {
          positive.set(key, entry.resource);
        }
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
      const entry = entries[i];
      if (!entry) continue;

      if (now - (entry as PositiveEntry<TResource>).updatedAt > ttlMs) {
        expiredIds.push(ids[i]);
      } else {
        result.set(ids[i], (entry as PositiveEntry<TResource>).resource);
      }
    }

    if (expiredIds.length > 0) {
      this.cache.delMany(expiredIds);
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
      const entry = entries[i];
      if (!entry) continue;

      if (now >= (entry as unknown as { expiry: number }).expiry) {
        expiredIds.push(keys[i]);
      } else {
        result.set(ids[i], entry as unknown as NegativeEntry);
      }
    }

    if (expiredIds.length > 0) {
      this.cache.delMany(expiredIds);
    }
    return result;
  }

  async storePositives(items: [id: string, data: TResource][]): Promise<void> {
    if (items.length === 0) return;
    const now = Date.now();

    await this.cache.setMany(
      items.map(([id, data]): [string, PositiveEntry<TResource>] => [id, { resource: data, updatedAt: now }]),
    );
  }

  async storeNegatives(ids: string[], reason: NegativeReason, ttlMs: number): Promise<void> {
    if (ids.length === 0) return;

    const expiry = Date.now() + ttlMs;
    const entry: NegativeEntry = { reason, expiry };
    await this.cache.setMany(ids.map(id => [`${NegativePrefix}${id}`, entry]));
  }

  async removeByIds(ids: string[]): Promise<void> {
    await this.cache.delMany(ids.concat(ids.map(prefixNegative)));
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }
}

export type NegativeReason = 'not-found' | 'unauthorized' | 'missing' | 'internal-server-error';

export interface NegativeEntry {
  reason: NegativeReason;
  expiry: number;
}

export interface PositiveEntry<TResource> {
  resource: TResource;
  updatedAt: number;
}
export type CacheEntry<TResource> = PositiveEntry<TResource> | NegativeEntry;

const NegativePrefix = 'neg:';
const prefixNegative = (id: string) => `${NegativePrefix}${id}`;
