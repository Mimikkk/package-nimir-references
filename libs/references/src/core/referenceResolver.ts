import { isNil, type Nil } from './common.ts';
import type { RefFields, Resolve, Source, SourceRegistry } from './types.ts';

const maxDepth = 10;

export type ResolveSyncResult<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>> =
  | { status: 'ok'; result: Resolve<TData, TSources, TFields> }
  | { status: 'needs-resolve' };

type DirectRef = string;
type NestedRef = { source: string; fields: Fields };
type Field = DirectRef | NestedRef | Fields;
type Fields = { [key: string]: Field };
type Target = Record<string, unknown>;

interface Ref {
  target: Target;
  property: string;
  source: string;
  isArray: boolean;
  fields?: Fields;
}

const isDirectRef = (value: Field): value is DirectRef => typeof value === 'string';
const isNestedRef = (value: Field): value is NestedRef =>
  typeof value === 'object' && value !== null && 'source' in value && 'fields' in value;
const isFields = (value: Field): value is Fields => typeof value === 'object' && value !== null && !isNestedRef(value);

function addSourceIds(map: Map<string, Set<string>>, source: string, values: unknown[]): void {
  let set = map.get(source);
  if (!set) {
    set = new Set<string>();
    map.set(source, set);
  }

  for (const value of values) {
    if (typeof value === 'string') set.add(value);
  }
}

export class ReferenceResolver<TSources extends SourceRegistry> {
  private constructor(private readonly sources: ReadonlyMap<string, Source>) {}

  static from<TSources extends SourceRegistry>(
    sources: ReadonlyMap<Extract<keyof TSources, string>, Source>,
  ): ReferenceResolver<TSources> {
    return new ReferenceResolver(sources);
  }

  async resolve<TData, TFields extends RefFields<TData, TSources>>(
    item: TData,
    fields: TFields,
  ): Promise<Resolve<TData, TSources, TFields> | Extract<TData, null | undefined>> {
    if (isNil(item)) {
      return item;
    }
    const out = await this.runLoop(item, fields as Fields, this.fetchBatchAsync.bind(this));
    return out.result as Resolve<TData, TSources, TFields>;
  }

  resolveSync<TData, TFields extends RefFields<TData, TSources>>(
    item: TData,
    fields: TFields,
  ): ResolveSyncResult<TData, TSources, TFields> {
    if (isNil(item)) {
      return { status: 'ok', result: item };
    }
    const out = this.runLoopSync(item, fields as Fields);

    return out.needsResolve
      ? { status: 'needs-resolve' }
      : { status: 'ok', result: out.result as Resolve<TData, TSources, TFields> };
  }

  private async fetchBatchAsync(sourceIdsMap: Map<string, Set<string>>): Promise<Map<string, Map<string, unknown>>> {
    const resolvedMaps = new Map<string, Map<string, unknown>>();
    await Promise.all(
      Array.from(sourceIdsMap.entries()).map(async ([source, ids]) => {
        const store = this.sources.get(source);
        if (!store) return;
        const items = await store.resolve(Array.from(ids));
        resolvedMaps.set(source, items as Map<string, unknown>);
      }),
    );
    return resolvedMaps;
  }

  private fetchBatchSync(sourceIdsMap: Map<string, Set<string>>): Map<string, Map<string, unknown>> | null {
    const resolvedMaps = new Map<string, Map<string, unknown>>();
    for (const [source, ids] of sourceIdsMap.entries()) {
      const store = this.sources.get(source);
      if (!store) return null;
      const resolved = store.tryResolveSync?.(Array.from(ids));
      if (resolved === null) return null;
      resolvedMaps.set(source, resolved as Map<string, unknown>);
    }
    return resolvedMaps;
  }

  private async runLoop(
    item: unknown,
    fields: Fields,
    fetchBatch: (m: Map<string, Set<string>>) => Promise<Map<string, Map<string, unknown>>>,
  ): Promise<{ result: Target | Target[] }> {
    const result = structuredClone(item) as Target | Target[];
    const runtimeFields = fields;
    const queue: { target: Target; fields: Fields }[] = Array.isArray(result)
      ? result.map(target => ({ target, fields: runtimeFields }))
      : [{ target: result, fields: runtimeFields }];

    let depth = 0;
    while (queue.length > 0) {
      if (++depth > maxDepth) break;

      const level = queue.splice(0, queue.length);
      const sourceIdsMap = new Map<string, Set<string>>();
      const references: Ref[] = [];

      for (const entry of level) {
        this.collect(entry.target, entry.fields, sourceIdsMap, references);
      }

      if (references.length === 0) break;

      const resolvedMaps = await fetchBatch(sourceIdsMap);
      this.applyResolved(references, resolvedMaps, queue);
    }

    return { result };
  }

  private runLoopSync(item: unknown, fields: Fields): { result: Target | Target[]; needsResolve: boolean } {
    const result = structuredClone(item) as Target | Target[];
    const runtimeFields = fields;
    const queue: { target: Target; fields: Fields }[] = Array.isArray(result)
      ? result.map(target => ({ target, fields: runtimeFields }))
      : [{ target: result, fields: runtimeFields }];

    let depth = 0;
    while (queue.length > 0) {
      if (++depth > maxDepth) break;

      const level = queue.splice(0, queue.length);
      const sourceIdsMap = new Map<string, Set<string>>();
      const references: Ref[] = [];

      for (const entry of level) {
        this.collect(entry.target, entry.fields, sourceIdsMap, references);
      }

      if (references.length === 0) break;

      const resolvedMaps = this.fetchBatchSync(sourceIdsMap);
      if (resolvedMaps === null) return { result, needsResolve: true };
      this.applyResolved(references, resolvedMaps, queue);
    }

    return { result, needsResolve: false };
  }

  private applyResolved(
    references: Ref[],
    resolvedMaps: Map<string, Map<string, unknown>>,
    queue: { target: Target; fields: Fields }[],
  ): void {
    for (const reference of references) {
      const resolvedMap = resolvedMaps.get(reference.source);
      if (!resolvedMap) continue;

      if (reference.isArray) {
        const ids = (reference.target[reference.property] ?? []) as Nil<string>[];
        const items = ids.map(id => (id ? (resolvedMap.get(id) ?? null) : null));
        reference.target[`${reference.property}Ts`] = items;

        if (reference.fields) {
          for (const nested of items) {
            if (nested && typeof nested === 'object') {
              queue.push({ target: nested as Target, fields: reference.fields });
            }
          }
        }
        continue;
      }

      const id = reference.target[reference.property] as Nil<string>;
      const nested = id ? (resolvedMap.get(id) ?? null) : null;
      reference.target[`${reference.property}T`] = nested;

      if (reference.fields && nested && typeof nested === 'object') {
        queue.push({ target: nested as Target, fields: reference.fields });
      }
    }
  }

  private collect(target: Target, fields: Fields, sourceIdsMap: Map<string, Set<string>>, references: Ref[]): void {
    for (const [property, field] of Object.entries(fields)) {
      const value = target[property];
      if (value === undefined || value === null) continue;

      if (isDirectRef(field)) {
        const values = Array.isArray(value) ? value : [value];
        addSourceIds(sourceIdsMap, field, values);
        references.push({ target, property, source: field, isArray: Array.isArray(value) });
        continue;
      }

      if (isNestedRef(field)) {
        const values = Array.isArray(value) ? value : [value];
        addSourceIds(sourceIdsMap, field.source, values);
        references.push({
          target,
          property,
          source: field.source,
          isArray: Array.isArray(value),
          fields: field.fields,
        });
        continue;
      }

      if (!isFields(field)) continue;

      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object') {
            this.collect(child as Target, field, sourceIdsMap, references);
          }
        }
      } else if (typeof value === 'object') {
        this.collect(value as Target, field, sourceIdsMap, references);
      }
    }
  }
}
