export { type AdapterCache } from '../adapters/adapterCache.ts';
export {
  defineReferences,
  type References,
  type ResolveFn,
  type ResolveOf,
  type SourcesBuilderContext,
} from '../impl/defineReferences.ts';
export {
  ReferenceCache as ResourceCache,
  type NegativeEntry,
  type NegativeReason,
  type PositiveEntry,
  type ResourceEntry,
} from '../impl/referenceCache.ts';
export { ReferenceResolver } from '../impl/referenceResolver.ts';
export {
  ReferenceStore as ResourceStore,
  type FetchAllStrategyOptions,
  type FetchByIdsStrategyOptions,
  type ResourceStoreOptions,
} from '../impl/store/resourceStore.ts';
export type { RefFields, Resolve, Source, SourceRegistry } from '../impl/types.ts';
