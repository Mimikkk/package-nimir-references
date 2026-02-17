import {
  createStore,
  delMany,
  getMany,
  clear as idbClear,
  entries as idbEntries,
  setMany,
  type UseStore,
} from 'idb-keyval';
import type { Cache } from '../../core/cache.ts';

class IdbKeyvalCache<TValue> implements Cache<TValue> {
  private constructor(private readonly store: UseStore) {}

  static from<TValue>({ database, table }: IdbKeyvalCacheOptions): IdbKeyvalCache<TValue> {
    return new IdbKeyvalCache(createStore(database, table));
  }

  async entries(): Promise<[string, TValue][]> {
    return await idbEntries<string, TValue>(this.store);
  }

  async getMany(keys: string[]): Promise<(TValue | undefined)[]> {
    return await getMany<TValue>(keys, this.store);
  }
  async setMany(entries: [key: string, item: TValue][]): Promise<void> {
    return await setMany(entries, this.store);
  }

  async delMany(keys: string[]): Promise<void> {
    return await delMany(keys, this.store);
  }

  async clear(): Promise<void> {
    return await idbClear(this.store);
  }
}

export interface IdbKeyvalCacheOptions {
  database: string;
  table: string;
}

export const createIdbKeyvalCache = IdbKeyvalCache.from;
