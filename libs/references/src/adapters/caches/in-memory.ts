import type { Cache } from '../../core/cache.ts';

export interface MemoryCacheOptions {}

class MemoryCache<TValue> implements Cache<TValue> {
  private constructor(private readonly items: Map<string, TValue>) {}

  static from<TValue>(): MemoryCache<TValue> {
    return new MemoryCache(new Map<string, TValue>());
  }

  async entries(): Promise<[string, TValue][]> {
    return Array.from(this.items.entries());
  }

  async getMany(keys: string[]): Promise<(TValue | undefined)[]> {
    return keys.map(key => this.items.get(key));
  }

  async setMany(entries: [key: string, item: TValue][]): Promise<void> {
    for (const [key, item] of entries) {
      this.items.set(key, item);
    }
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

export const createMemoryCache = MemoryCache.from;
