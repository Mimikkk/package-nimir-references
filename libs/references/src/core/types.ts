import type { Awaitable, Nil } from './common.ts';

/**
 * A named source of resources addressable by string IDs.
 *
 * Sources are created via `defineReferences(...).source(...)`.
 * The resolver calls `resolve(ids)` and expects a map for the requested IDs.
 */
export interface Source<TResource = unknown> {
  /**
   * Resolves the given IDs.
   *
   * - IDs not found should map to `null`.
   * - It is OK to return a map missing some keys; the resolver treats them as missing.
   */
  resolve(ids: string[]): Awaitable<Map<string, TResource | null>>;

  /**
   * Attempts to resolve IDs from application/cached data only.
   * Returns a map when all IDs can be resolved without external fetch; otherwise `null`.
   */
  tryResolveSync?(ids: string[]): Map<string, TResource | null> | null;

  /**
   * Invalidates cached entries.
   *
   * If `ids` is omitted, the source should invalidate everything it knows about.
   */
  invalidate(ids?: string[]): Promise<void>;

  /**
   * Clears all cached entries for this source (including any persistent cache).
   */
  clearAll(): Promise<void>;

  /**
   * Loads currently cached results from persistent cache into app memory.
   * No-op if the source has no cache. Use in useEffect for eager hydration.
   */
  warmup?(): Promise<void>;
}

/**
 * Registry of named sources.
 *
 * Keys are source names referenced by `fields` configs.
 */
export type SourceRegistry = Record<string, Source>;

/**
 * Extracts the resource type produced by a source.
 */
export type SourceOf<TSource extends Source> = TSource extends Source<infer TValue> ? TValue : never;

type StrRef = Nil<string>;
type ArrRef = Nil<StrRef[]>;
type PotentialRef = StrRef | ArrRef;

type DirectRef<TSources extends SourceRegistry> = keyof TSources;

type NestedRef<TSources extends SourceRegistry, TSource extends keyof TSources = keyof TSources> =
  TSource extends DirectRef<TSources>
    ? { source: TSource; fields: RefFields<SourceOf<TSources[TSource]>, TSources> }
    : never;

type FieldRef<TSources extends SourceRegistry> = DirectRef<TSources> | NestedRef<TSources>;

/**
 * Configuration object that describes where reference IDs live inside `TData`.
 *
 * It mirrors the shape of `TData`:
 * - For a field that contains a reference ID (`string | null | undefined` or array of those),
 *   you specify a source name (direct) or `{ source, fields }` (nested).
 * - For regular objects/arrays-of-objects, you can keep nesting to reach the ref fields.
 */
export type RefFields<TData, TSources extends SourceRegistry> = TData extends readonly (infer TElement)[]
  ? RefFields<TElement, TSources>
  : {
      [TKey in keyof TData]?: TData[TKey] extends PotentialRef ? FieldRef<TSources> : RefFields<TData[TKey], TSources>;
    };

type TypeKey<TData, TType> = keyof TData extends infer TKey extends string
  ? TKey extends keyof TData
    ? TData[TKey] extends TType
      ? TKey
      : never
    : never
  : never;

type StrKey<TKey extends string> = `${TKey}T`;
type ArrKey<TKey extends string> = `${TKey}Ts`;

type StrKeys<TData> = TypeKey<TData, StrRef>;
type ArrKeys<TData> = TypeKey<TData, ArrRef>;

type DataKeys<TData> = keyof TData;
type RefKeys<TData> = StrKey<StrKeys<TData>> | ArrKey<ArrKeys<TData>>;

type RecordKeys<TData> = DataKeys<TData> | RefKeys<TData>;

type ResolveRef<TRef, TSources extends SourceRegistry> =
  TRef extends DirectRef<TSources>
    ? SourceOf<TSources[TRef]>
    : TRef extends NestedRef<TSources>
      ? Resolve<SourceOf<TSources[TRef['source']]>, TSources, TRef['fields']>
      : never;

type ResolveDataKey<
  TData,
  TKey extends DataKeys<TData>,
  TSources extends SourceRegistry,
  TFields extends RefFields<TData, TSources>,
> = TKey extends keyof TFields
  ? TData[TKey] extends PotentialRef
    ? TData[TKey]
    : TFields[TKey] extends RefFields<NonNullable<TData[TKey]>, TSources>
      ? Resolve<TData[TKey], TSources, TFields[TKey]>
      : never
  : TData[TKey];

type ResolveRefKey<TKey, TSources extends SourceRegistry, TFields> =
  TKey extends ArrKey<infer TArrKey extends string & keyof TFields>
    ? ResolveRef<TFields[TArrKey], TSources>[]
    : TKey extends StrKey<infer TStrKey extends string & keyof TFields>
      ? ResolveRef<TFields[TStrKey], TSources>
      : never;

type ResolveRecord<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>> = {
  [TKey in RecordKeys<TData>]: TKey extends DataKeys<TData>
    ? ResolveDataKey<TData, TKey, TSources, TFields>
    : Nil<ResolveRefKey<TKey, TSources, TFields>>;
};

type ResolveArray<
  TData extends readonly unknown[],
  TSources extends SourceRegistry,
  TFields extends RefFields<TData, TSources>,
> = Resolve<TData[number], TSources, TFields>[];

/**
 * Resolved output type produced by `inline` / `fn`.
 *
 * Adds `T`/`Ts` properties next to reference ID fields described by `TFields`.
 * - `x: string | null | undefined` → `xT: <resolved> | null | undefined`
 * - `x: Array<string | null | undefined>` → `xTs: Array<<resolved> | null>`
 */
export type Resolve<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>> = TData extends
  | null
  | undefined
  ? TData
  : TData extends readonly unknown[]
    ? ResolveArray<TData, TSources, TFields>
    : ResolveRecord<TData, TSources, TFields>;
