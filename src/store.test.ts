import { describe, expect, it, vi } from 'vitest';

import { SourceStore } from './store.ts';

type Entity = { id: string };

const entity = (id: string): Entity => ({ id });

const a1 = entity('a1');
const a2 = entity('a2');

describe('References - SourceStore', () => {
  describe('fetchAll mode', () => {
    it('resolves IDs after warm-up', async () => {
      const store = SourceStore.from<Entity>({ name: 'test', fetchAll: async () => [a1, a2], cache: false });

      const result = await store.resolve([a1.id, a2.id]);

      expect(result.get(a1.id)).toEqual(a1);
      expect(result.get(a2.id)).toEqual(a2);
    });

    it('returns null for IDs not in the dataset', async () => {
      const store = SourceStore.from<Entity>({ name: 'test', fetchAll: async () => [a1], cache: false });

      const result = await store.resolve([a1.id, 'missing']);

      expect(result.get(a1.id)).toEqual(a1);
      expect(result.get('missing')).toBeNull();
    });

    it('calls fetchAll only once (dedup)', async () => {
      const fetchAll = vi.fn(async () => [a1]);
      const store = SourceStore.from<Entity>({ name: 'test', fetchAll, cache: false });

      await Promise.all([store.resolve([a1.id]), store.resolve([a1.id]), store.resolve([a1.id])]);

      expect(fetchAll).toHaveBeenCalledTimes(1);
    });

    it('uses custom key function', async () => {
      const items = [{ code: 'X', label: 'X Label' }];
      const store = SourceStore.from<(typeof items)[0]>({
        name: 'test',
        fetchAll: async () => items,
        keyBy: i => i.code,
        cache: false,
      });

      const result = await store.resolve(['X']);

      expect(result.get('X')).toEqual(items[0]);
    });
  });

  describe('fetch mode', () => {
    it('fetches and caches items by ID', async () => {
      const fetch = vi.fn(async (ids: string[]) => ids.map(entity));
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      const result = await store.resolve(['a', 'b']);

      expect(result.get('a')).toEqual(entity('a'));
      expect(result.get('b')).toEqual(entity('b'));
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(['a', 'b']);
    });

    it('serves subsequent requests from mem cache', async () => {
      const fetch = vi.fn(async (ids: string[]) => ids.map(entity));
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      await store.resolve(['a']);
      const result = await store.resolve(['a']);

      expect(result.get('a')).toEqual(entity('a'));
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('marks missing IDs as negative and does not re-fetch', async () => {
      const fetch = vi.fn(async () => []);
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      const r1 = await store.resolve(['missing']);
      expect(r1.get('missing')).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);

      const r2 = await store.resolve(['missing']);
      expect(r2.get('missing')).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('negative cache entry expires after negativeTtl', async () => {
      vi.useFakeTimers();
      const negativeTtl = 1;

      const fetch = vi.fn(async () => []);
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false, ttl: 1 });

      await store.resolve(['x']);
      expect(fetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(negativeTtl + 1);

      await store.resolve(['x']);
      expect(fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('handles 401/403 as unauthorized negative entries', async () => {
      const fetch = vi.fn(async () => {
        throw Object.assign(new Error(), { status: 403 });
      });
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      const r1 = await store.resolve(['x']);
      expect(r1.get('x')).toBeNull();

      const r2 = await store.resolve(['x']);
      expect(r2.get('x')).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('handles 404 as not-found negative entries', async () => {
      const fetch = vi.fn(async () => {
        throw Object.assign(new Error(), { status: 404 });
      });
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      const result = await store.resolve(['x']);
      expect(result.get('x')).toBeNull();
    });

    it('handles internal server error as internal-server-error negative entries', async () => {
      const fetch = vi.fn(async () => {
        throw Object.assign(new Error(), { status: 500 });
      });
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      const result = await store.resolve(['x']);
      expect(result.get('x')).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('chunks requests by batchSize', async () => {
      const fetch = vi.fn(async (ids: string[]) => ids.map(entity));

      const batchSize = 2;
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false, batchSize });

      const items = ['a', 'b', 'c', 'd', 'e'];
      const batchCount = Math.ceil(items.length / batchSize);

      const result = await store.resolve(items);
      expect(result.size).toBe(items.length);
      expect(fetch).toHaveBeenCalledTimes(batchCount);
      expect(fetch.mock.calls[0][0]).toEqual(['a', 'b']);
      expect(fetch.mock.calls[1][0]).toEqual(['c', 'd']);
      expect(fetch.mock.calls[2][0]).toEqual(['e']);
    });

    it('deduplicates concurrent resolve calls for the same ID', async () => {
      const resolvers = Promise.withResolvers<Entity[]>();

      const fetch = vi.fn(() => resolvers.promise);
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      const p1 = store.resolve(['a']);
      const p2 = store.resolve(['a']);

      resolvers.resolve([entity('a')]);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.get('a')).toEqual(entity('a'));
      expect(r2.get('a')).toEqual(entity('a'));
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidation', () => {
    it('invalidate(ids) clears specific entries from cache', async () => {
      const fetch = vi.fn(async (ids: string[]) => ids.map(entity));
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      await store.resolve(['a', 'b']);
      expect(fetch).toHaveBeenCalledTimes(1);

      store.invalidate(['a']);

      await store.resolve(['a', 'b']);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1][0]).toEqual(['a']);
    });

    it('invalidate() without ids clears all', async () => {
      const fetch = vi.fn(async (ids: string[]) => ids.map(entity));
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      await store.resolve(['a', 'b']);
      store.invalidate();
      await store.resolve(['a', 'b']);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1][0]).toEqual(['a', 'b']);
    });

    it('invalidate clears negative cache entries too', async () => {
      const fetch = vi.fn(async () => []);
      const store = SourceStore.from<Entity>({ name: 'test', fetch, cache: false });

      await store.resolve(['x']);
      expect(fetch).toHaveBeenCalledTimes(1);

      store.invalidate(['x']);
      await store.resolve(['x']);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('fetchAll failure does not poison warmUpPromise — retries on next call', async () => {
      const ErrorMessage = 'Network down';

      let callCount = 0;

      const fetchAll = vi.fn(async () => {
        if (++callCount === 1) throw new Error(ErrorMessage);
        return [a1];
      });
      const store = SourceStore.from<Entity>({ name: 'test', fetchAll, cache: false });

      await expect(store.resolve([a1.id])).rejects.toThrow(ErrorMessage);

      const result = await store.resolve([a1.id]);
      expect(result.get(a1.id)).toEqual(a1);
      expect(fetchAll).toHaveBeenCalledTimes(2);
    });

    it('clearAll resets everything', async () => {
      const fetchAll = vi.fn(async () => [a1]);
      const store = SourceStore.from<Entity>({ name: 'test', fetchAll, cache: false });

      await store.resolve([a1.id]);
      expect(fetchAll).toHaveBeenCalledTimes(1);

      await store.clearAll();
      await store.resolve([a1.id]);
      expect(fetchAll).toHaveBeenCalledTimes(2);
    });
  });
});
