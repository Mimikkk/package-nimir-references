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
export { defineReferences, type ResolveOf, type SourcesOf } from '../core/defineReferences.ts';
export {
  ReferenceCache,
  type NegativeEntry,
  type NegativeReason,
  type PositiveEntry,
  type ResourceEntry,
} from '../core/referenceCache.ts';
export { ReferenceResolver, type ResolveSyncResult } from '../core/referenceResolver.ts';
export {
  ReferenceStore,
  type FetchAllStrategyOptions,
  type FetchByIdsStrategyOptions,
  type ResourceStoreOptions,
} from '../core/referenceStore.ts';
export type { RefFields, Resolve, Source, SourceRegistry } from '../core/types.ts';
