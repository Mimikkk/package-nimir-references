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

export interface Cache<T> {
  get(key: string): Promise<T | null>;
  getMany(keys: string[]): Promise<T[]>;
  entries(): Promise<[string, T][]>;
  values(): Promise<T[]>;
  keys(): Promise<string[]>;
  set(key: string, item: T): Promise<void>;
  setMany(entries: [key: string, item: T][]): Promise<void>;
  del(key: string): Promise<void>;
  delMany(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

export class IndexDbCache<T> implements Cache<T> {
  private constructor(private readonly store: UseStore) {}

  static fromNames<T>(database: string, store: string): IndexDbCache<T> {
    return new IndexDbCache(createStore(database, store));
  }

  async values(): Promise<T[]> {
    return await idbValues<T>(this.store);
  }

  async keys(): Promise<string[]> {
    return await idbKeys<string>(this.store);
  }

  async entries(): Promise<[string, T][]> {
    return await idbEntries(this.store);
  }

  async get(key: string): Promise<T | null> {
    const entry = await get<T>(key, this.store);
    return entry ?? null;
  }

  async getMany(keys: string[]): Promise<T[]> {
    return await getMany<T>(keys, this.store);
  }

  async set(key: string, item: T): Promise<void> {
    await set(key, item, this.store);
  }

  async setMany(entries: [key: string, item: T][]): Promise<void> {
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

export class SourceCache<T> {
  private constructor(private readonly cache: Cache<any>) {}

  public static fromCache<T>(cache: Cache<T>): SourceCache<T> {
    return new SourceCache(cache);
  }

  async read<T>(ttl: number): Promise<{ positive: Map<string, T>; negative: Map<string, NegativeEntry> }> {
    const entries = await this.cache.entries();
    const positive = new Map<string, T>();
    const negative = new Map<string, NegativeEntry>();
    const now = Date.now();

    for (const [key, value] of entries) {
      if (key.startsWith(NegativePrefix)) {
        const entry = value as NegativeEntry;
        if (now < entry.expiry) {
          negative.set(key.slice(NegativePrefix.length), entry);
        }
      } else {
        const entry = value as CacheEntry<T>;
        if (now - entry.updatedAt <= ttl) {
          positive.set(key, entry.data);
        }
      }
    }

    return { positive, negative };
  }

  async readPositives<T>(ids: string[], ttl: number): Promise<Map<string, T>> {
    if (ids.length === 0) return new Map();

    const now = Date.now();
    const expiredIds: string[] = [];
    const entries = await this.cache.getMany(ids);

    const result = new Map<string, T>();
    for (let i = 0; i < ids.length; ++i) {
      const entry = entries[i];
      if (!entry) continue;

      if (now - entry.updatedAt > ttl) {
        expiredIds.push(ids[i]);
      } else {
        result.set(ids[i], entry.data);
      }
    }

    if (expiredIds.length > 0) {
      this.cache.delMany(expiredIds);
    }

    return result;
  }

  async readNegatives(ids: string[]): Promise<Map<string, NegativeEntry>> {
    if (ids.length === 0) return new Map();

    const now = Date.now();
    const expiredIds: string[] = [];

    const keys = ids.map(prefixNegative);
    const entries = await this.cache.getMany(keys);
    const result = new Map<string, NegativeEntry>();
    for (let i = 0; i < ids.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      if (now >= entry.expiry) {
        expiredIds.push(keys[i]);
      } else {
        result.set(ids[i], entry);
      }
    }

    if (expiredIds.length > 0) {
      this.cache.delMany(expiredIds);
    }
    return result;
  }

  async persistPositives<T>(items: [id: string, data: T][]): Promise<void> {
    if (items.length === 0) return;
    const now = Date.now();

    await this.cache.setMany(items.map(([id, data]): [string, CacheEntry<T>] => [id, { data, updatedAt: now }]));
  }

  async persistNegatives(ids: string[], reason: NegativeReason, ttl: number): Promise<void> {
    if (ids.length === 0) return;
    const expiry = Date.now() + ttl;

    await this.cache.setMany(ids.map(id => [`${NegativePrefix}${id}`, { reason, expiry }]));
  }

  async clearIds(ids: string[]): Promise<void> {
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

export interface CacheEntry<T = unknown> {
  data: T;
  updatedAt: number;
}
const NegativePrefix = 'neg:';
const prefixNegative = (id: string) => `${NegativePrefix}${id}`;
