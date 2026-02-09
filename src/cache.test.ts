import { describe, expect, it, vi } from 'vitest';

import { IndexDbCache, SourceCache } from './cache.ts';
import { SourceStore } from './store.ts';

type Entity = { id: string };

const entity = (id: string): Entity => ({ id });

const a1 = entity('a1');
const a2 = entity('a2');

const createCache = (name: string) => SourceCache.fromCache(IndexDbCache.fromNames(name, 'test'));

describe('References - Cache', () => {
  it('persists to IDB and serves from it after invalidate + re-create', async () => {
    const fetchFn = vi.fn(async (ids: string[]) => ids.map(entity));
    const storeName = `idb-test-${Date.now()}`;

    const store1 = SourceStore.from<Entity>({ name: storeName, fetch: fetchFn, cache: true });
    await store1.resolve(['a']);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const store2 = SourceStore.from<Entity>({ name: storeName, fetch: fetchFn, cache: true });
    const result = await store2.resolve(['a']);

    expect(result.get('a')).toEqual(entity('a'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('persistPositives + readPositives round-trip', async () => {
    const cache = createCache(`pers-pos-${Date.now()}`);
    await cache.persistPositives([
      ['a', entity('a')],
      ['b', entity('b')],
    ]);
    const result = await cache.readPositives<Entity>(['a', 'b', 'c'], Infinity);

    expect(result.get('a')).toEqual(entity('a'));
    expect(result.get('b')).toEqual(entity('b'));
    expect(result.has('c')).toBe(false);
  });

  it('getPositive filters expired entries', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);

    const cache = createCache(`pers-exp-${Date.now()}`);
    await cache.persistPositives([['a', entity('a')]]);

    now.mockReturnValue(2000);

    const result = await cache.readPositives<Entity>(['a'], 500);
    expect(result.has('a')).toBe(false);
    now.mockRestore();
  });

  it('persistNegatives + readNegatives round-trip', async () => {
    const cache = createCache(`pers-neg-${Date.now()}`);
    await cache.persistNegatives(['x', 'y'], 'not-found', 60_000);

    const result = await cache.readNegatives(['x', 'y', 'z']);
    expect(result.get('x')).toMatchObject({ reason: 'not-found' });
    expect(result.get('y')).toMatchObject({ reason: 'not-found' });
    expect(result.has('z')).toBe(false);
  });

  it('getNegative filters expired entries', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);

    const cache = createCache(`pers-negexp-${Date.now()}`);
    await cache.persistNegatives(['x'], 'missing', 500);

    now.mockReturnValue(1600);

    const result = await cache.readNegatives(['x']);
    expect(result.has('x')).toBe(false);
    now.mockRestore();
  });

  it('read returns both positive and negative entries', async () => {
    const cache = createCache(`pers-loadall-${Date.now()}`);
    await cache.persistPositives([['a', entity('a')]]);
    await cache.persistNegatives(['b'], 'unauthorized', 60_000);

    const { positive, negative } = await cache.read<Entity>(Infinity);
    expect(positive.get('a')).toEqual(entity('a'));
    expect(negative.get('b')).toMatchObject({ reason: 'unauthorized' });
  });

  it('read filters expired positive and negative entries', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);

    const cache = createCache(`pers-loadexp-${Date.now()}`);
    await cache.persistPositives([['a', entity('a')]]);
    await cache.persistNegatives(['b'], 'missing', 500);

    now.mockReturnValue(2000);

    const { positive, negative } = await cache.read<Entity>(500);
    expect(positive.has('a')).toBe(false);
    expect(negative.has('b')).toBe(false);
    now.mockRestore();
  });

  it('clearIds removes both positive and negative keys', async () => {
    const cache = createCache(`pers-del-${Date.now()}`);
    await cache.persistPositives([['a', entity('a')]]);
    await cache.persistNegatives(['a'], 'not-found', 60_000);

    await cache.clearIds(['a']);

    const positives = await cache.readPositives<Entity>(['a'], Infinity);
    const negatives = await cache.readNegatives(['a']);
    expect(positives.has('a')).toBe(false);
    expect(negatives.has('a')).toBe(false);
  });

  it('clear removes all positive and negative entries', async () => {
    const cache = createCache(`pers-clear-${Date.now()}`);
    await cache.persistPositives([['a', entity('a')]]);
    await cache.persistNegatives(['b'], 'missing', 60_000);

    await cache.clear();

    const { positive, negative } = await cache.read<Entity>(Infinity);
    expect(positive.size).toBe(0);
    expect(negative.size).toBe(0);
  });

  it('handles empty positive and negative arrays gracefully', async () => {
    const cache = createCache(`pers-empty-${Date.now()}`);

    const positives = await cache.readPositives([], Infinity);
    const negatives = await cache.readNegatives([]);
    await cache.persistPositives([]);
    await cache.persistNegatives([], 'missing', 1000);

    expect(positives.size).toBe(0);
    expect(negatives.size).toBe(0);
  });
  it('fetch mode persists items to IDB and warm-ups from it', async () => {
    const storeName = `idb-fetchall-${Date.now()}`;
    const fetchAll = vi.fn(async () => [a1, a2]);

    const store1 = SourceStore.from<Entity>({ name: storeName, fetchAll, cache: true });
    await store1.resolve([a1.id]);
    expect(fetchAll).toHaveBeenCalledTimes(1);

    const fetchAll2 = vi.fn(async () => [a1, a2]);
    const store2 = SourceStore.from<Entity>({ name: storeName, fetchAll: fetchAll2, cache: true });
    const result = await store2.resolve([a1.id, a2.id]);

    expect(result.get(a1.id)).toEqual(a1);
    expect(result.get(a2.id)).toEqual(a2);
    expect(fetchAll2).not.toHaveBeenCalled();
  });

  it('fetch mode negative entries persist and survive invalidate + re-create', async () => {
    const storeName = `idb-neg-${Date.now()}`;
    const fetch1 = vi.fn(async () => []);

    const store1 = SourceStore.from<Entity>({
      name: storeName,
      fetch: fetch1,
      cache: true,
      ttlMs: 60_000,
    });
    await store1.resolve(['missing']);
    expect(fetch1).toHaveBeenCalledTimes(1);

    const fetch2 = vi.fn(async () => []);
    const store2 = SourceStore.from<Entity>({
      name: storeName,
      fetch: fetch2,
      cache: true,
      ttlMs: 60_000,
    });
    const result = await store2.resolve(['missing']);

    expect(result.get('missing')).toBeNull();
    expect(fetch2).not.toHaveBeenCalled();
  });
});
