/**
 * @packageDocumentation
 *
 * Type-safe nested reference resolver for resource graphs.
 *
 * The public API is:
 * - `defineReferences(...)` to register named sources
 * - `references.inline(...)` / `references.fn(...)` to resolve payloads
 * - `ResourceStore` + `ResourceCache` to control fetching and caching
 *
 * Resolution convention:
 * - For a ref field `x: string | null | undefined` the resolver adds `xT`.
 * - For a ref field `x: Array<string | null | undefined>` the resolver adds `xTs`.
 */
export { type AdapterCache } from '../adapters/adapterCache.ts';
export { defineReferences, type References, type ResolveFn, type ResolveOf, type SourcesBuilderContext, } from '../impl/defineReferences.ts';
export { ReferenceCache as ResourceCache, type NegativeEntry, type NegativeReason, type PositiveEntry, type ResourceEntry, } from '../impl/referenceCache.ts';
export { ReferenceResolver } from '../impl/referenceResolver.ts';
export { ReferenceStore as ResourceStore, type FetchAllStrategyOptions, type FetchByIdsStrategyOptions, type ResourceStoreOptions, } from '../impl/store/resourceStore.ts';
export type { RefFields, Resolve, Source, SourceRegistry } from '../impl/types.ts';
