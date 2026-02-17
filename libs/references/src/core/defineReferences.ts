import { ReferenceResolver } from './referenceResolver.ts';
import { ReferenceSource, type ResourceSourceOptions } from './referenceSource.ts';
import type { Source, SourceRegistry } from './types.ts';

export interface SourcesContext {
  /**
   * Creates a source backed by an internal store strategy.
   *
   * Choose one:
   * - `fetchByIds` to fetch the requested IDs (with batching, inflight-dedupe, negative caching).
   * - `fetchAll` to fetch and keep a whole collection (with TTL refresh).
   */
  source<TData>(options: ResourceSourceOptions<TData>): Source<TData>;
}

export const sourcesContext: SourcesContext = {
  source<TData>(options: ResourceSourceOptions<TData>): Source<TData> {
    return ReferenceSource.from(options);
  },
};

export interface ReferenceContext<TSources extends SourceRegistry> {
  stores: ReadonlyMap<Extract<keyof TSources, string>, Source>;
  resolver: ReferenceResolver<TSources>;
}

export function createReferenceContext<TSources extends SourceRegistry>(
  sources: (context: SourcesContext) => TSources,
): ReferenceContext<TSources> {
  const stores = new Map(Object.entries(sources(sourcesContext)) as [Extract<keyof TSources, string>, Source][]);
  const resolver = ReferenceResolver.from(stores);

  return { stores, resolver };
}
