import type { Awaitable, Nil } from './common.ts';

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
  resolveSync(ids: string[]): Map<string, TResource | null> | null;

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
  warmup(): Promise<void>;
}

/**
 * Named source registry used by the resolver schema.
 *
 * Example:
 * ```ts
 * const sources = {
 *   users: source<User>(...),
 *   teams: source<Team>(...),
 * } satisfies SourceRegistry;
 * ```
 */
export type SourceRegistry = Record<string, Source>;

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
 * Resolution schema describing which fields contain references.
 *
 * For each field:
 * - `'users'` means the field contains a user ID or array of IDs.
 * - `{ source: 'users', fields: {...} }` resolves nested references on the resolved user object.
 *
 * Example:
 * ```ts
 * const fields = {
 *   assigneeId: 'users',
 *   watcherIds: 'users',
 *   organizationId: {
 *     source: 'orgs',
 *     fields: { ownerUserId: 'users' },
 *   },
 * } satisfies RefFields<Ticket, TSources>;
 * ```
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

type StrKeys<TData, TFields extends object> = TypeKey<TData, StrRef> & keyof TFields;
type ArrKeys<TData, TFields extends object> = TypeKey<TData, ArrRef> & keyof TFields;

type DataKeys<TData> = keyof TData;
type RefKeys<TData, TFields extends object> = StrKey<StrKeys<TData, TFields>> | ArrKey<ArrKeys<TData, TFields>>;

type RecordKeys<TData, TFields extends object> = DataKeys<TData> | RefKeys<TData, TFields>;

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
  [TKey in RecordKeys<TData, TFields>]: TKey extends DataKeys<TData>
    ? ResolveDataKey<TData, TKey, TSources, TFields>
    : Nil<ResolveRefKey<TKey, TSources, TFields>>;
};

type ResolveArray<
  TData extends readonly unknown[],
  TSources extends SourceRegistry,
  TFields extends RefFields<TData, TSources>,
> = Resolve<TData[number], TSources, TFields>[];

/**
 * Resolved output shape for a payload and resolution schema.
 *
 * Naming convention:
 * - `field: string | null | undefined` adds `fieldT`
 * - `field: Array<string | null | undefined>` adds `fieldTs`
 */
export type Resolve<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>> = TData extends
  | null
  | undefined
  ? TData
  : TData extends readonly unknown[]
    ? ResolveArray<TData, TSources, TFields>
    : ResolveRecord<TData, TSources, TFields>;
