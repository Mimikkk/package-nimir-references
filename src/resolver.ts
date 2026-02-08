import type { Nil } from './common.ts';

import type { SourceStore } from './store.ts';

export class SourceResolver {
  private constructor(private readonly stores: ReadonlyMap<string, SourceStore>) {}

  public static from(stores: ReadonlyMap<string, SourceStore>): SourceResolver {
    return new SourceResolver(stores);
  }

  async resolve<T>(item: T, fields: Fields): Promise<T> {
    const result = structuredClone(item) as Target;
    const queue: { target: Target; fields: Fields }[] = [{ target: result, fields }];
    let depth = 0;

    while (queue.length > 0) {
      if (++depth > MaxDepth) {
        break;
      }

      const level = queue.splice(0, queue.length);

      const sourceIdsMaps = new Map<string, Set<string>>();
      const references: Ref[] = [];

      for (const item of level) {
        this.collectreferences(item.target, item.fields, sourceIdsMaps, references);
      }

      if (references.length === 0) break;

      const resolvedMaps = new Map<string, Map<string, unknown>>();
      await Promise.all(
        Array.from(sourceIdsMaps.entries()).map(async ([source, ids]) => {
          const store = this.stores.get(source);
          if (!store) return;

          const items = await store.resolve(Array.from(ids));
          resolvedMaps.set(source, items);
        }),
      );

      for (const ref of references) {
        const resolvedMap = resolvedMaps.get(ref.source);
        if (!resolvedMap) continue;

        if (ref.isArray) {
          const ids = (ref.target[ref.property] ?? []) as ArrRef;
          const items = ids.map(id => (id ? (resolvedMap.get(id) ?? null) : null));

          ref.target[`${ref.property}Ts`] = items;
          if (ref.fields) {
            for (const item of items) {
              if (item && typeof item === 'object') {
                queue.push({ target: item as Target, fields: ref.fields });
              }
            }
          }
        } else {
          const id = ref.target[ref.property] as StrRef;
          const item = id ? (resolvedMap.get(id) ?? null) : null;
          ref.target[`${ref.property}T`] = item;

          if (ref.fields && item && typeof item === 'object') {
            queue.push({ target: item as Target, fields: ref.fields });
          }
        }
      }
    }

    return result as T;
  }

  private collectreferences(
    target: Target,
    fields: Fields,
    sourceIdsMaps: Map<string, Set<string>>,
    references: Ref[],
  ): void {
    for (const [property, field] of Object.entries(fields)) {
      const value = target[property];
      if (value === undefined || value === null) continue;

      if (isDirectRef(field)) {
        const isArray = Array.isArray(value);

        addSourceIds(sourceIdsMaps, field, isArray ? value : [value]);

        references.push({ target, property, source: field, isArray });
      } else if (isRecordRef(field)) {
        const isArray = Array.isArray(value);

        addSourceIds(sourceIdsMaps, field.source, isArray ? value : [value]);

        references.push({ target, property, source: field.source, isArray, fields: field.fields });
      } else if (typeof field === 'object' && field !== null) {
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child === 'object') {
              this.collectreferences(child as Target, field as Fields, sourceIdsMaps, references);
            }
          }
        } else if (typeof value === 'object') {
          this.collectreferences(value as Target, field as Fields, sourceIdsMaps, references);
        }
      }
    }
  }
}

function addSourceIds(map: Map<string, Set<string>>, source: string, values: unknown[]): void {
  let set = map.get(source);

  if (!set) {
    set = new Set();
    map.set(source, set);
  }

  for (const value of values) {
    if (typeof value === 'string') set.add(value);
  }
}

const MaxDepth = 10;
const isDirectRef = (value: Field): value is DirectRef => typeof value === 'string';
const isRecordRef = (value: Field): value is RecordRef =>
  typeof value === 'object' && value !== null && 'source' in value && 'fields' in value;

type StrRef = Nil<string>;
type ArrRef = StrRef[];

type DirectRef = string;

interface RecordRef {
  source: string;
  fields: Fields;
}

interface Fields {
  [entry: string]: Field;
}

type Target = Record<string, unknown>;
type Field = DirectRef | RecordRef | Fields;

interface Ref {
  target: Target;
  property: string;
  source: string;
  isArray: boolean;
  fields?: Fields;
}
