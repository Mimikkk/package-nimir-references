import type { Cache } from '../../core/cache.ts';

/**
 * Minimal Redis-like client interface.
 *
 * `RedisLike<string>` is structurally compatible with `createClient()` from the `redis` package.
 */
export interface RedisLike<T> {
  del(keys: string[]): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  mGet(keys: string[]): Promise<(T | null)[]>;
  mSet(entries: [string, T][]): Promise<unknown>;
}

export interface RedisCacheOptions<TValue> {
  /** The Redis client instance. */
  client: RedisLike<TValue>;
  /** Key prefix to scope entries. Default: `"refs:"`. */
  prefix?: string;
}

const defaultPrefix = 'refs:';

class RedisCache<TValue> implements Cache<TValue> {
  private constructor(
    private readonly client: RedisLike<TValue>,
    private readonly prefix: string,
  ) {}

  static from<TValue>({ client, prefix }: RedisCacheOptions<TValue>): RedisCache<TValue> {
    return new RedisCache(client, prefix ?? defaultPrefix);
  }

  async entries(): Promise<[string, TValue][]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length === 0) return [];

    const values = await this.client.mGet(keys);
    const result: [string, TValue][] = [];
    for (let i = 0; i < keys.length; i++) {
      const v = values[i];
      if (v !== null) result.push([keys[i].substring(this.prefix.length), v]);
    }
    return result;
  }

  async getMany(keys: string[]): Promise<(TValue | undefined)[]> {
    if (keys.length === 0) return [];
    const values = await this.client.mGet(keys.map(k => this.prefix + k));
    return values.map(v => v ?? undefined);
  }

  async setMany(entries: [key: string, item: TValue][]): Promise<void> {
    if (entries.length === 0) return;
    await this.client.mSet(entries.map(([k, v]) => [this.prefix + k, v]));
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(keys.map(k => this.prefix + k));
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length === 0) return;
    await this.client.del(keys);
  }
}

export const createRedisCache = RedisCache.from;
