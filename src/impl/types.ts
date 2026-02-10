import type { Awaitable, Nil, Nullable } from './common.ts';

export interface Source<TResource = unknown> {
  resolve(ids: string[]): Awaitable<Map<string, TResource | null>>;
  invalidate(ids?: string[]): Promise<void>;
  clearAll(): Promise<void>;
}

export type SourceRegistry = Record<string, Source>;
export type SourceOf<TSource extends Source> = TSource extends Source<infer TValue> ? TValue : never;

type StrRef = Nil<string>;
type ArrRef = Nil<string>[];
type PotentialRef = StrRef | ArrRef;

type DirectRef<TSources extends SourceRegistry> = keyof TSources;

type NestedRef<TSources extends SourceRegistry, TSource extends keyof TSources = keyof TSources> =
  TSource extends DirectRef<TSources>
    ? { source: TSource; fields: RefFields<SourceOf<TSources[TSource]>, TSources> }
    : never;

type FieldRef<TSources extends SourceRegistry> = DirectRef<TSources> | NestedRef<TSources>;

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
    : Nullable<ResolveRefKey<TKey, TSources, TFields>>;
};

type ResolveArray<
  TData extends readonly unknown[],
  TSources extends SourceRegistry,
  TFields extends RefFields<TData, TSources>,
> = Resolve<TData[number], TSources, TFields>[];

export type Resolve<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>> = TData extends
  | null
  | undefined
  ? TData
  : TData extends readonly unknown[]
    ? ResolveArray<TData, TSources, TFields>
    : ResolveRecord<TData, TSources, TFields>;
