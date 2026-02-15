import { API } from './API.ts';
import type { Fn } from './common.ts';
import { ReferenceResolver } from './referenceResolver.ts';
import { ReferenceStore, type ResourceStoreOptions } from './referenceStore.ts';
import type { RefFields, Resolve, Source, SourceRegistry } from './types.ts';

export type FnAwait<TFn extends Fn> = Awaited<ReturnType<TFn>>;

/**
 * Type of a resolved wrapper around an async function.
 *
 * This is the return type of `references.fn(...)`.
 */
export interface ResolveFn<
  TFn extends Fn,
  TSources extends SourceRegistry,
  TFields extends RefFields<FnAwait<TFn>, TSources>,
> {
  (...params: Parameters<TFn>): Promise<Resolve<FnAwait<TFn>, TSources, TFields>>;
}

/**
 * Extracts the resolved data type from an async function type.
 *
 * Useful when you want the payload type without calling the function.
 */
export type ResolveOf<TType extends Fn> = TType extends (...params: any[]) => Promise<infer TData> ? TData : never;

export interface SourcesContext {
  /**
   * Creates a source backed by an internal store strategy.
   *
   * Choose one:
   * - `fetchByIds` to fetch the requested IDs (with batching, inflight-dedupe, negative caching).
   * - `fetchAll` to fetch and keep a whole collection (with TTL refresh).
   */
  source<TData>(options: ResourceStoreOptions<TData>): Source<TData>;
}

export const sourcesContext: SourcesContext = {
  source<TData>(options: ResourceStoreOptions<TData>): Source<TData> {
    return ReferenceStore.from(options);
  },
};

export function defineReferences<TSources extends SourceRegistry>(
  sources: (context: SourcesContext) => TSources,
): API<TSources> {
  const stores = new Map(Object.entries(sources(sourcesContext)) as [Extract<keyof TSources, string>, Source][]);
  const resolver = ReferenceResolver.from(stores);

  return API.from<TSources>(stores, resolver);
}
export type SourcesOf<TAPI extends API<any>> =
  TAPI extends API<infer TSources extends SourceRegistry> ? TSources : never;
