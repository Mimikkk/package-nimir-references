import type { AdapterCache } from './adapterCache.ts';

export interface MemoryCacheOptions {}

class MemoryCache<TValue> implements AdapterCache<TValue> {
  private constructor(private readonly items: Map<string, TValue>) {}

  static new<TValue>(): MemoryCache<TValue> {
    return new MemoryCache(new Map<string, TValue>());
  }

  async get(key: string): Promise<TValue | undefined> {
    return this.items.get(key);
  }

  async getMany(keys: string[]): Promise<(TValue | undefined)[]> {
    return keys.map(key => this.items.get(key));
  }

  async entries(): Promise<[string, TValue][]> {
    return Array.from(this.items.entries());
  }

  async values(): Promise<TValue[]> {
    return Array.from(this.items.values());
  }

  async keys(): Promise<string[]> {
    return Array.from(this.items.keys());
  }

  async set(key: string, item: TValue): Promise<void> {
    this.items.set(key, item);
  }

  async setMany(entries: [key: string, item: TValue][]): Promise<void> {
    for (const [key, item] of entries) {
      this.items.set(key, item);
    }
  }

  async del(key: string): Promise<void> {
    this.items.delete(key);
  }

  async delMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.items.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}

export const createMemoryCache = MemoryCache.new;
