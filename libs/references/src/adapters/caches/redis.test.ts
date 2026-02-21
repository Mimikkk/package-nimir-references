import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RedisLike } from './redis.ts';
import { createRedisCache } from './redis.ts';

function createRedisLike<T>(): RedisLike<T> {
  const store = new Map<string, T>();

  return {
    async del(keys) {
      let count = 0;
      for (const k of keys) if (store.delete(k)) count++;
      return count;
    },
    async keys(pattern) {
      const prefix = pattern.replace(/\*$/, '');
      return [...store.keys()].filter(k => k.startsWith(prefix));
    },
    async mGet(keys) {
      return keys.map(k => store.get(k) ?? null);
    },
    async mSet(entries) {
      for (const [k, v] of entries) store.set(k, v);
    },
  };
}

describe('Caches - RedisCache (redislike)', () => {
  it('setMany + getMany round-trip', async () => {
    const cache = createRedisCache({ client: createRedisLike() });

    await cache.setMany([
      ['a', { v: 1 }],
      ['b', { v: 2 }],
    ]);

    const result = await cache.getMany(['a', 'b', 'c']);
    expect(result).toEqual([{ v: 1 }, { v: 2 }, undefined]);
  });

  it('entries returns all stored values', async () => {
    const cache = createRedisCache({ client: createRedisLike() });

    await cache.setMany([
      ['x', 10],
      ['y', 20],
    ]);

    const entries = await cache.entries();
    expect(entries).toEqual(
      expect.arrayContaining([
        ['x', 10],
        ['y', 20],
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  it('delMany removes keys', async () => {
    const cache = createRedisCache({ client: createRedisLike() });

    await cache.setMany([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);

    await cache.delMany(['a', 'c']);

    const result = await cache.getMany(['a', 'b', 'c']);
    expect(result).toEqual([undefined, 2, undefined]);
  });

  it('clear removes all keys under the prefix', async () => {
    const client = createRedisLike<number | string>();
    const cache = createRedisCache({ client, prefix: 'app:' });

    await client.mSet([['other:key', 'keep']]);
    await cache.setMany([
      ['a', 1],
      ['b', 2],
    ]);

    await cache.clear();

    const entries = await cache.entries();
    expect(entries).toHaveLength(0);

    expect((await client.mGet(['other:key']))[0]).toBe('keep');
  });

  it('prefix isolation between caches', async () => {
    const client = createRedisLike();
    const cacheA = createRedisCache({ client, prefix: 'a:' });
    const cacheB = createRedisCache({ client, prefix: 'b:' });

    await cacheA.setMany([['id', 'from-a']]);
    await cacheB.setMany([['id', 'from-b']]);

    expect(await cacheA.getMany(['id'])).toEqual(['from-a']);
    expect(await cacheB.getMany(['id'])).toEqual(['from-b']);

    await cacheA.clear();
    expect(await cacheA.getMany(['id'])).toEqual([undefined]);
    expect(await cacheB.getMany(['id'])).toEqual(['from-b']);
  });

  it('getMany with empty keys returns empty array', async () => {
    const cache = createRedisCache({ client: createRedisLike() });
    expect(await cache.getMany([])).toEqual([]);
  });

  it('delMany with empty keys is a no-op', async () => {
    const cache = createRedisCache({ client: createRedisLike() });
    await cache.delMany([]);
    expect(await cache.entries()).toEqual([]);
  });
});

describe('Caches - RedisCache (redis container with redis-package)', () => {
  let container: StartedRedisContainer;
  let client: ReturnType<typeof createClient>;

  beforeAll(async () => {
    container = await new RedisContainer('redis:8-alpine').start();
    client = createClient({ url: container.getConnectionUrl() });
    await client.connect();
  }, 60_000);

  afterAll(async () => {
    await client.destroy();
    await container.stop();
  });

  it('setMany + getMany round-trip', async () => {
    const cache = createRedisCache<string>({ client, prefix: 'test:' });

    await cache.setMany([
      ['a', 'one'],
      ['b', 'two'],
    ]);

    const result = await cache.getMany(['a', 'b', 'c']);
    expect(result).toEqual(['one', 'two', undefined]);

    await cache.clear();
  });

  it('entries returns all stored values', async () => {
    const cache = createRedisCache<string>({ client, prefix: 'ent:' });

    await cache.setMany([
      ['x', 'ten'],
      ['y', 'twenty'],
    ]);

    const entries = await cache.entries();
    expect(entries).toEqual(
      expect.arrayContaining([
        ['x', 'ten'],
        ['y', 'twenty'],
      ]),
    );
    expect(entries).toHaveLength(2);

    await cache.clear();
  });

  it('delMany removes keys', async () => {
    const cache = createRedisCache<string>({ client, prefix: 'del:' });

    await cache.setMany([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);

    await cache.delMany(['a', 'c']);

    const result = await cache.getMany(['a', 'b', 'c']);
    expect(result).toEqual([undefined, '2', undefined]);

    await cache.clear();
  });

  it('clear removes only prefixed keys', async () => {
    await client.set('unrelated', 'keep');

    const cache = createRedisCache<string>({ client, prefix: 'clr:' });
    await cache.setMany([
      ['a', '1'],
      ['b', '2'],
    ]);

    await cache.clear();

    expect(await cache.entries()).toHaveLength(0);
    expect(await client.get('unrelated')).toBe('keep');

    await client.del('unrelated');
  });
});
