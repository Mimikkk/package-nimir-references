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
import type { AdapterCache } from './adapterCache.ts';

class IdbKeyvalCache<TValue> implements AdapterCache<TValue> {
  private constructor(private readonly store: UseStore) {}

  static new<TValue>({ database, table }: IdbKeyvalCacheOptions): IdbKeyvalCache<TValue> {
    return new IdbKeyvalCache(createStore(database, table));
  }

  async get(key: string): Promise<TValue | undefined> {
    return await get<TValue>(key, this.store);
  }

  async getMany(keys: string[]): Promise<(TValue | undefined)[]> {
    return await getMany<TValue>(keys, this.store);
  }

  async entries(): Promise<[string, TValue][]> {
    return await idbEntries<string, TValue>(this.store);
  }

  async values(): Promise<TValue[]> {
    return await idbValues<TValue>(this.store);
  }

  async keys(): Promise<string[]> {
    return await idbKeys<string>(this.store);
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

export interface IdbKeyvalCacheOptions {
  database: string;
  table: string;
}

export const createIdbKeyvalCache = IdbKeyvalCache.new;
