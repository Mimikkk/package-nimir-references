import type { Fn, Nil, Nullable } from './common.ts';

export interface SourceOptions<T> {
  /** Batch fetch items by IDs. */
  fetch?: (ids: string[]) => Promise<T[]>;
  /** Load entire dataset at once. */
  fetchAll?: () => Promise<T[]>;
  /** Extract ID from an item. Default: `(item) => item.id`. */
  keyBy?: (item: T) => string;
  /** Positive cache TTL in ms. */
  ttl?: number;
  /** Max IDs per `fetch` call. Chunks automatically if exceeded. */
  batchSize?: number;
  /** IDB caching. Default: `true`. */
  cache?: boolean;
}

export interface Source<T = unknown> {
  readonly _type: T;
}

export type SourceRegistry = Record<string, Source>;

export type SourceOf<TSource extends Source> = TSource['_type'];

export type FnResult<TFn extends Fn> = Awaited<ReturnType<TFn>>;

export type StrRef = Nil<string>;
export type ArrRef = Nil<string>[];
export type PotentialRef = StrRef | ArrRef;

export type DirectRef<TSources extends SourceRegistry> = Extract<keyof TSources, string>;
export type NestedRef<TSources extends SourceRegistry> = {
  [TSource in keyof TSources]: { source: TSource; fields: RefFields<SourceOf<TSources[TSource]>, TSources> };
}[keyof TSources];

export type FieldRef<TSources extends SourceRegistry> = DirectRef<TSources> | NestedRef<TSources>;

export type RefFields<TData, TSources extends SourceRegistry> = {
  [K in keyof TData]?: TData[K] extends PotentialRef
    ? FieldRef<TSources>
    : NonNullable<TData[K]> extends unknown[]
      ? RefFields<NonNullable<TData[K]>[number], TSources>
      : NonNullable<TData[K]> extends object
        ? RefFields<NonNullable<TData[K]>, TSources>
        : `[Error: '${K & string}' is not a referenceable field]`;
};

type TypeKey<TKey, TValue> = { [K in keyof TKey]: NonNullable<TKey[K]> extends TValue ? K : never }[keyof TKey];
type StrKey<T extends string> = `${T}T`;
type ArrKey<T extends string> = `${T}Ts`;

type StrKeys<T, TFields> = Extract<TypeKey<T, StrRef>, keyof TFields & string>;
type ArrKeys<T, TFields> = Extract<TypeKey<T, ArrRef>, keyof TFields & string>;

type RefKeys<TData, TFields extends RefFields<TData, TSources>, TSources extends SourceRegistry> =
  | StrKey<StrKeys<TData, TFields>>
  | ArrKey<ArrKeys<TData, TFields>>;

type ResolveRef<TRef, TSources extends SourceRegistry> = TRef extends string
  ? SourceOf<TSources[TRef]>
  : TRef extends { source: infer K extends keyof TSources; fields: infer F }
    ? ResolvedItem<SourceOf<TSources[K]>, TSources, F & RefFields<SourceOf<TSources[K]>, TSources>>
    : never;

type ResolveOriginalField<
  TData,
  TKey extends keyof TData,
  TSources extends SourceRegistry,
  TFields extends RefFields<TData, TSources>,
> = TKey extends keyof TFields
  ? TData[TKey] extends PotentialRef
    ? TData[TKey]
    : NonNullable<TData[TKey]> extends unknown[]
      ? ResolvedItem<NonNullable<NonNullable<TData[TKey]>[number]>, TSources, NonNullable<TFields[TKey]>>[]
      : ResolvedItem<NonNullable<TData[TKey]>, TSources, NonNullable<TFields[TKey]>>
  : TData[TKey];

type ResolveRefField<TKey, TSources extends SourceRegistry, TFields> =
  TKey extends ArrKey<infer TArrKey extends string & keyof TFields>
    ? Nullable<ResolveRef<TFields[TArrKey], TSources>>[]
    : TKey extends StrKey<infer TStrKey extends string & keyof TFields>
      ? Nullable<ResolveRef<TFields[TStrKey], TSources>>
      : never;

export type ResolvedItem<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>> = {
  [TKey in keyof TData | RefKeys<TData, TFields, TSources>]: TKey extends keyof TData
    ? ResolveOriginalField<TData, TKey, TSources, TFields>
    : ResolveRefField<TKey, TSources, TFields>;
};

export interface ResolvedFn<
  TFn extends Fn,
  TSources extends SourceRegistry,
  TFields extends RefFields<Awaited<ReturnType<TFn>>, TSources>,
> {
  (...params: Parameters<TFn>): Promise<ResolvedItem<Awaited<ReturnType<TFn>>, TSources, TFields>>;
}

export interface References<TSources extends SourceRegistry> {
  inline<TItem, TFields extends RefFields<TItem, TSources>, TResult = ResolvedItem<TItem, TSources, TFields>>(
    item: TItem,
    options: {
      fields: TFields;
      transform?: (result: ResolvedItem<TItem, TSources, NoInfer<TFields>>) => TResult;
    },
  ): Promise<TResult>;
  fn<
    TFn extends Fn,
    TFields extends RefFields<FnResult<TFn>, TSources>,
    TResult = ResolvedItem<FnResult<TFn>, TSources, TFields>,
  >(
    fn: TFn,
    options: {
      fields: TFields;
      transform?: (result: ResolvedItem<FnResult<TFn>, TSources, NoInfer<TFields>>) => TResult;
    },
  ): (...params: Parameters<TFn>) => Promise<TResult>;
  invalidate(source: Extract<keyof TSources, string>, ids?: string[]): void;
  clear(): Promise<void>;
}

export interface SourcesBuilderContext {
  source<T>(options: SourceOptions<T>): Source<T>;
}

export type ResolveOf<TType extends (...params: any[]) => Promise<any>> = TType extends (
  ...params: any[]
) => Promise<infer TData>
  ? TData
  : never;
