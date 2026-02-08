import { describe, expect, it, vi } from 'vitest';

import { defineReferences } from './references.ts';

type Entity = { id: string };

const entity = (id: string): Entity => ({ id });

const a1 = entity('a1');
const a2 = entity('a2');
const b1 = entity('b1');
const b2 = entity('b2');

describe('References - Builder', () => {
  const as = [a1, a2];
  const bs = [b1, b2];

  const references = defineReferences(c => ({
    A: c.source<Entity>({ fetchAll: async () => as, cache: false, ttl: 0 }),
    B: c.source<Entity>({ fetchAll: async () => bs, cache: false, ttl: 0 }),
  }));

  describe('inline mode', () => {
    it('resolves a single direct ref', async () => {
      const item = { aId: a1.id, x: 1 };
      const result = await references.inline(item, { fields: { aId: 'A' } });

      expect(result).toEqual({ aId: a1.id, aIdT: a1, x: 1 });
    });

    it('resolves multiple references from different sources', async () => {
      const item = { aId: a1.id, bId: b1.id };
      const result = await references.inline(item, { fields: { aId: 'A', bId: 'B' } });

      expect(result).toEqual({ aId: a1.id, aIdT: a1, bId: b1.id, bIdT: b1 });
    });

    it('resolves array references', async () => {
      const item = { aIds: [a1.id, a2.id] };
      const result = await references.inline(item, { fields: { aIds: 'A' } });

      expect(result).toEqual({ aIds: [a1.id, a2.id], aIdsTs: [a1, a2] });
    });

    it('does not mutate the original item', async () => {
      const item = { aId: a1.id };
      const result = await references.inline(item, { fields: { aId: 'A' } });

      expect(result).not.toBe(item);
      expect(item).not.toHaveProperty('aIdT');
    });
  });

  describe('fn mode', () => {
    it('wraps an async function and resolves references', async () => {
      const fetch = references.fn(async () => ({ aId: a2.id, data: 'ok' }), { fields: { aId: 'A' } });
      const result = await fetch();

      expect(result).toEqual({ aId: a2.id, aIdT: a2, data: 'ok' });
    });

    it('passes through function arguments', async () => {
      const fetchItem = async (id: string) => ({ aId: id, data: id });
      const resolved = references.fn(fetchItem, { fields: { aId: 'A' } });

      const result = await resolved(a1.id);

      expect(result).toEqual({ aId: a1.id, aIdT: a1, data: a1.id });
    });
  });

  describe('invalidate', () => {
    it('invalidate forces re-fetch on next resolve', async () => {
      const fetchAll = vi.fn(async () => [a1]);
      const references = defineReferences(c => ({
        A: c.source<Entity>({ fetchAll, cache: false, ttl: 0 }),
      }));

      await references.inline({ fId: a1.id }, { fields: { fId: 'A' } });
      expect(fetchAll).toHaveBeenCalledTimes(1);
      references.invalidate('A');

      await references.inline({ fId: a1.id }, { fields: { fId: 'A' } });
      expect(fetchAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('clear resets all source caches', async () => {
      const fetchAs = vi.fn(async () => [a1]);
      const fetchBs = vi.fn(async () => [b1]);

      const references = defineReferences(c => ({
        A: c.source<Entity>({ fetchAll: fetchAs, cache: false, ttl: 0 }),
        B: c.source<Entity>({ fetchAll: fetchBs, cache: false, ttl: 0 }),
      }));

      await references.inline({ fId: a1.id, bId: b1.id }, { fields: { fId: 'A', bId: 'B' } });
      expect(fetchAs).toHaveBeenCalledTimes(1);
      expect(fetchBs).toHaveBeenCalledTimes(1);

      await references.clear();

      await references.inline({ fId: a1.id, bId: b1.id }, { fields: { fId: 'A', bId: 'B' } });
      expect(fetchAs).toHaveBeenCalledTimes(2);
      expect(fetchBs).toHaveBeenCalledTimes(2);
    });
  });
});
