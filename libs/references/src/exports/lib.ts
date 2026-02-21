/**
 * @packageDocumentation
 *
 * Type-safe nested reference resolver for resource graphs.
 *
 * The public API is:
 * - `defineReferences(...)` to register named sources
 * - `references.inline(...)` / `references.fn(...)` to resolve payloads
 * - `ReferenceSource` + `ReferenceCache` to control fetching and caching
 *
 * Resolution convention:
 * - For a ref field `x: string | null | undefined` the resolver adds `xT`.
 * - For a ref field `x: Array<string | null | undefined>` the resolver adds `xTs`.
 */
export { defineReferences, Refs } from '../adapters/frameworks/vanilla.ts';
export type { ResolveOf, ResolveOptions, SourcesOf } from '../adapters/frameworks/vanilla.ts';
export type { Cache } from '../core/cache.ts';
export { ReferenceCache } from '../core/referenceCache.ts';
export type { NegativeEntry, NegativeReason, PositiveEntry, ResourceEntry } from '../core/referenceCache.ts';
export { ReferenceResolver } from '../core/referenceResolver.ts';
export type { ResolveSyncResult } from '../core/referenceResolver.ts';
export { ReferenceSource } from '../core/referenceSource.ts';
export type {
  CompleteStrategyOptions,
  PartialStrategyOptions,
  ResourceSourceOptions,
} from '../core/referenceSource.ts';
export type { RefFields, Resolve, Source, SourceRegistry } from '../core/types.ts';
