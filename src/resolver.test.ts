import { describe, expect, it } from 'vitest';

import { SourceResolver } from './resolver.ts';
import { ResourceStore } from './store.ts';

type Entity = { id: string };

const entity = (id: string): Entity => ({ id });

const a1 = entity('f1');
const a2 = entity('f2');
const b1 = entity('b1');

function mockStore(items: Entity[]): ResourceStore<Entity> {
  return ResourceStore.from<Entity>({ fetchAll: () => items });
}

function createResolver(configs: Record<string, Entity[]>): SourceResolver<any> {
  const stores = new Map<string, ResourceStore>();
  for (const [name, items] of Object.entries(configs)) {
    const store = mockStore(items);
    stores.set(name, store as ResourceStore);
  }
  return SourceResolver.from(stores);
}

describe('References - Resolver', () => {
  it('resolves a direct single ref (string → T)', async () => {
    const resolver = createResolver({ Faculty: [a1, a2] });
    const item = { facultyId: 'f1', other: 42 };
    const result = await resolver.resolve(item, { facultyId: 'Faculty' });

    expect(result).toEqual({
      facultyId: 'f1',
      facultyIdT: a1,
      other: 42,
    });
  });

  it('resolves an array of direct refs (string[] → Ts[])', async () => {
    const resolver = createResolver({ Faculty: [a1, a2] });
    const result = await resolver.resolve([{ id: a1.id }, { id: a2.id }], { id: 'Faculty' });

    expect(result).toEqual([
      { id: a1.id, idT: a1 },
      { id: a2.id, idT: a2 },
    ]);
  });

  it('resolves a direct array ref (string[] → Ts)', async () => {
    const resolver = createResolver({ Faculty: [a1, a2] });
    const item = { facultyIds: ['f1', 'f2'] };
    const result = await resolver.resolve(item, { facultyIds: 'Faculty' });

    expect(result).toEqual({
      facultyIds: ['f1', 'f2'],
      facultyIdsTs: [a1, a2],
    });
  });

  it('resolves multiple fields from different sources in parallel', async () => {
    const resolver = createResolver({
      Faculty: [a1],
      Branch: [b1],
    });
    const item = { facultyId: 'f1', branchId: 'b1' };
    const result = await resolver.resolve(item, { facultyId: 'Faculty', branchId: 'Branch' });

    expect(result).toEqual({
      facultyId: 'f1',
      facultyIdT: a1,
      branchId: 'b1',
      branchIdT: b1,
    });
  });

  it('resolves null/undefined fields as null T', async () => {
    const resolver = createResolver({ Faculty: [a1] });
    const item = { facultyId: null as string | null, branchId: undefined as string | undefined };
    const result: any = await resolver.resolve(item, { facultyId: 'Faculty', branchId: 'Faculty' });

    expect(result.facultyIdT).toBeUndefined();
    expect(result.branchIdT).toBeUndefined();
  });

  it('resolves missing IDs as null', async () => {
    const resolver = createResolver({ Faculty: [a1] });
    const item = { facultyId: 'nonexistent' };
    const result: any = await resolver.resolve(item, { facultyId: 'Faculty' });

    expect(result.facultyIdT).toBeNull();
  });

  it('handles structural nesting into sub-objects', async () => {
    const resolver = createResolver({ Faculty: [a1] });
    const item = { nested: { deepId: 'f1' } };
    const result = await resolver.resolve(item, { nested: { deepId: 'Faculty' } });

    expect(result).toEqual({
      nested: { deepId: 'f1', deepIdT: a1 },
    });
  });

  it('handles structural nesting into arrays of objects', async () => {
    const resolver = createResolver({ Faculty: [a1, a2] });
    const item = { items: [{ fId: 'f1' }, { fId: 'f2' }] };
    const result = await resolver.resolve(item, { items: { fId: 'Faculty' } });

    expect(result).toEqual({
      items: [
        { fId: 'f1', fIdT: a1 },
        { fId: 'f2', fIdT: a2 },
      ],
    });
  });

  it('handles nested references (multi-step resolution)', async () => {
    const branch1 = { id: 'b1', facultyId: 'f1' };
    const resolver = createResolver({
      Branch: [branch1],
      Faculty: [a1],
    });

    const item = { branchId: 'b1' };
    const result: any = await resolver.resolve(item, {
      branchId: { source: 'Branch', fields: { facultyId: 'Faculty' } },
    });

    expect(result.branchIdT).toBeTruthy();
    expect(result.branchIdT.facultyIdT).toEqual(a1);
  });

  it('handles array nested references (multi-step, array IDs → resolved children)', async () => {
    const b1 = { id: 'b1', facultyId: 'f1' };
    const b2 = { id: 'b2', facultyId: 'f2' };
    const resolver = createResolver({
      Branch: [b1 as any, b2 as any],
      Faculty: [a1, a2],
    });

    const item = { branchIds: ['b1', 'b2'] };
    const result: any = await resolver.resolve(item, {
      branchIds: { source: 'Branch', fields: { facultyId: 'Faculty' } },
    });

    expect(result.branchIdsTs).toHaveLength(2);
    expect(result.branchIdsTs[0].facultyIdT).toEqual(a1);
    expect(result.branchIdsTs[1].facultyIdT).toEqual(a2);
  });

  it('does not mutate the original item (structuredClone)', async () => {
    const resolver = createResolver({ Faculty: [a1] });
    const item = { facultyId: 'f1' };
    const result = await resolver.resolve(item, { facultyId: 'Faculty' });

    expect(result).not.toBe(item);
    expect(item).not.toHaveProperty('facultyIdT');
  });

  it('handles deeply nested structural + ref chains', async () => {
    const resolver = createResolver({ Faculty: [a1] });
    const item = { a: { b: [{ c: { fId: 'f1' } }] } };
    const result = await resolver.resolve(item, { a: { b: { c: { fId: 'Faculty' } } } });

    expect((result as any).a.b[0].c.fIdT).toEqual(a1);
  });

  it('handles empty arrays gracefully', async () => {
    const resolver = createResolver({ Faculty: [a1] });
    const item = { ids: [] as string[] };
    const result = await resolver.resolve(item, { ids: 'Faculty' });

    expect(result).toEqual({ ids: [], idsTs: [] });
  });

  it('skips unknown source names without crashing', async () => {
    const resolver = createResolver({});
    const item = { fId: 'f1' };
    const result = await resolver.resolve(item, { fId: 'NonExistent' });

    expect(result).toEqual({ fId: 'f1' });
  });

  it('stops at MAX_RESOLVE_DEPTH to prevent infinite loops from deep/circular configs', async () => {
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

    const result: any = await resolver.resolve(item, fields);

    expect(result.aIdT).toBeTruthy();
  });

  it('resolves a nested array of refs (array of objects → array of objects with refs)', async () => {
    const resolver = createResolver({ Faculty: [a1, a2] });
    const item = { items: [{ fId: 'f1' }, { fId: 'f2' }] };
    const result = await resolver.resolve(item, { items: { fId: 'Faculty' } });

    expect(result).toEqual({
      items: [
        { fId: 'f1', fIdT: a1 },
        { fId: 'f2', fIdT: a2 },
      ],
    });
  });
});
