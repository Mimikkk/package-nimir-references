import { describe, expect, it } from 'vitest';

import { Nil } from './common.ts';
import { ReferenceResolver } from './referenceResolver.ts';
import { ReferenceSource } from './referenceSource.ts';
import type { SourceRegistry } from './types.ts';

type Entity = { id: string };

const entity = (id: string): Entity => ({ id });

const a1 = entity('f1');
const a2 = entity('f2');
const b1 = entity('b1');

function createResolver(configs: Record<string, Entity[]>): ReferenceResolver<SourceRegistry> {
  const stores = new Map<string, ReferenceSource<Entity>>();
  for (const [name, items] of Object.entries(configs)) {
    const store = ReferenceSource.from({ list: () => items });
    stores.set(name, store);
  }

  return ReferenceResolver.from(stores);
}

describe('References - Resolver', () => {
  it('resolves a direct single ref (string → T)', async () => {
    const resolver = createResolver({ A: [a1, a2] });
    const item = { aId: 'f1', other: 42 };
    const result = await resolver.resolve(item, { aId: 'A' });

    expect(result).toEqual({
      aId: 'f1',
      aIdT: a1,
      other: 42,
    });
  });

  it('resolves an array of direct refs (string[] → Ts[])', async () => {
    const resolver = createResolver({ A: [a1, a2] });
    const result = await resolver.resolve([{ id: a1.id }, { id: a2.id }], { id: 'A' });

    expect(result).toEqual([
      { id: a1.id, idT: a1 },
      { id: a2.id, idT: a2 },
    ]);
  });

  it('resolves a direct array ref (string[] → Ts)', async () => {
    const resolver = createResolver({ A: [a1, a2] });
    const item = { aIds: ['f1', 'f2'] };
    const result = await resolver.resolve(item, { aIds: 'A' });

    expect(result).toEqual({
      aIds: ['f1', 'f2'],
      aIdsTs: [a1, a2],
    });
  });

  it('resolves multiple fields from different sources in parallel', async () => {
    const resolver = createResolver({
      A: [a1],
      Branch: [b1],
    });
    const item = { aId: 'f1', branchId: 'b1' };
    const result = await resolver.resolve(item, { aId: 'A', branchId: 'Branch' });

    expect(result).toEqual({
      aId: 'f1',
      aIdT: a1,
      branchId: 'b1',
      branchIdT: b1,
    });
  });

  it('resolves null/undefined fields as null T', async () => {
    const resolver = createResolver({ A: [a1] });
    const item = { aId: null as string | null, branchId: undefined as string | undefined };
    const result: any = await resolver.resolve(item, { aId: 'A', branchId: 'A' });

    expect(result.aIdT).toBeUndefined();
    expect(result.branchIdT).toBeUndefined();
  });

  it('resolves missing IDs as null', async () => {
    const resolver = createResolver({ A: [a1] });
    const item = { aId: 'nonexistent' };
    const result: any = await resolver.resolve(item, { aId: 'A' });

    expect(result.aIdT).toBeNull();
  });

  it('handles structural nesting into sub-objects', async () => {
    const resolver = createResolver({ A: [a1] });
    const item = { nested: { deepId: 'f1' } };
    const result = await resolver.resolve(item, { nested: { deepId: 'A' } });

    expect(result).toEqual({
      nested: { deepId: 'f1', deepIdT: a1 },
    });
  });

  it('handles structural nesting into arrays of objects', async () => {
    const resolver = createResolver({ A: [a1, a2] });
    const item = { items: [{ fId: 'f1' }, { fId: 'f2' }] };
    const result = await resolver.resolve(item, { items: { fId: 'A' } });

    expect(result).toEqual({
      items: [
        { fId: 'f1', fIdT: a1 },
        { fId: 'f2', fIdT: a2 },
      ],
    });
  });

  it('handles nested references (multi-step resolution)', async () => {
    const branch1 = { id: 'b1', aId: 'f1' };
    const resolver = createResolver({
      Branch: [branch1],
      A: [a1],
    });

    const item = { branchId: 'b1' };
    const result: any = await resolver.resolve(item, {
      branchId: { source: 'Branch', fields: { aId: 'A' } },
    });

    expect(result.branchIdT).toBeTruthy();
    expect(result.branchIdT.aIdT).toEqual(a1);
  });

  it('handles array nested references (multi-step, array IDs → resolved children)', async () => {
    const b1 = { id: 'b1', aId: 'f1' };
    const b2 = { id: 'b2', aId: 'f2' };
    const resolver = createResolver({
      Branch: [b1 as any, b2 as any],
      A: [a1, a2],
    });

    const item = { branchIds: ['b1', 'b2'] };
    const result: any = await resolver.resolve(item, {
      branchIds: { source: 'Branch', fields: { aId: 'A' } },
    });

    expect(result.branchIdsTs).toHaveLength(2);
    expect(result.branchIdsTs[0].aIdT).toEqual(a1);
    expect(result.branchIdsTs[1].aIdT).toEqual(a2);
  });

  it('does not mutate the original item (structuredClone)', async () => {
    const resolver = createResolver({ A: [a1] });
    const item = { aId: 'f1' };
    const result = await resolver.resolve(item, { aId: 'A' });

    expect(result).not.toBe(item);
    expect(item).not.toHaveProperty('aIdT');
  });

  it('handles deeply nested structural + ref chains', async () => {
    const resolver = createResolver({ A: [a1] });
    const item = { a: { b: [{ c: { fId: 'f1' } }] } };
    const result = await resolver.resolve(item, { a: { b: { c: { fId: 'A' } } } });

    expect((result as any).a.b[0].c.fIdT).toEqual(a1);
  });

  it('handles empty arrays gracefully', async () => {
    const resolver = createResolver({ A: [a1] });
    const item = { ids: [] as string[] };
    const result = await resolver.resolve(item, { ids: 'A' });

    expect(result).toEqual({ ids: [], idsTs: [] });
  });

  it('skips unknown source names without crashing', async () => {
    const resolver = createResolver({});
    const item = { fId: 'f1' };
    const result = await resolver.resolve(item, { fId: 'NonExistent' });

    expect(result).toEqual({ fId: 'f1' });
  });

  it('throws when resolution exceeds maximum depth', async () => {
    const a = { id: 'a1', bId: 'b1' };
    const b = { id: 'b1', aId: 'a1' };
    const resolver = createResolver({ A: [a], B: [b] });

    let fields: any = 'B';
    for (let i = 0; i < 12; i++) {
      const key = i % 2 === 0 ? 'bId' : 'aId';
      const source = i % 2 === 0 ? 'B' : 'A';
      fields = { [key]: { source, fields } };
    }

    const item = { aId: 'a1' };

    await expect(resolver.resolve(item, fields)).rejects.toThrow('exceeded maximum depth');
  });

  it('resolves a nested array of refs (array of objects → array of objects with refs)', async () => {
    const resolver = createResolver({ A: [a1, a2] });
    const item = { items: [{ fId: 'f1' }, { fId: 'f2' }] };
    const result = await resolver.resolve(item, { items: { fId: 'A' } });

    expect(result).toEqual({
      items: [
        { fId: 'f1', fIdT: a1 },
        { fId: 'f2', fIdT: a2 },
      ],
    });
  });

  describe('resolveSync', () => {
    it('returns needs-resolve when source not warmed', () => {
      const resolver = createResolver({ A: [a1] });
      const item = { aId: 'f1' };
      const out = resolver.resolveSync(item, { aId: 'A' });
      expect(out.status).toBe('needs-resolve');
    });

    it('returns ok with result when all refs in cache', async () => {
      const resolver = createResolver({ A: [a1, a2] });
      await resolver.resolve({ aId: 'f1' }, { aId: 'A' });
      const out = resolver.resolveSync({ aId: 'f1' }, { aId: 'A' });
      expect(out).toEqual({ status: 'ok', result: { aId: 'f1', aIdT: a1 } });
    });

    it('returns ok with null for missing id when fetchAll warmed (full collection known)', async () => {
      const resolver = createResolver({ A: [a1] });
      await resolver.resolve({ aId: 'f1' }, { aId: 'A' });
      const out = resolver.resolveSync({ aId: 'nonexistent' }, { aId: 'A' });
      expect(out).toEqual({ status: 'ok', result: { aId: 'nonexistent', aIdT: null } });
    });

    it('returns ok for null/undefined item', () => {
      const resolver = createResolver({ A: [a1] });
      expect(resolver.resolveSync(null as { aId: Nil<string> } | null, { aId: 'A' })).toEqual({
        status: 'ok',
        result: null,
      });

      expect(resolver.resolveSync(undefined as { aId: Nil<string> } | undefined, { aId: 'A' })).toEqual({
        status: 'ok',
        result: undefined,
      });
    });

    it('skips unknown source names in sync path', () => {
      const resolver = createResolver({});
      const out = resolver.resolveSync({ fId: 'f1' }, { fId: 'NonExistent' });
      expect(out).toEqual({ status: 'ok', result: { fId: 'f1' } });
    });
  });
});
