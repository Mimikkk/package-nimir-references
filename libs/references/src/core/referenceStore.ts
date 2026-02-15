import { Awaitable } from './common.ts';
import type { ReferenceCache } from './referenceCache.ts';
import { FetchAllStrategy, FetchByIdsStrategy, ResourceStoreStrategy } from './strategies.ts';
import type { Source } from './types.ts';

const hour4 = 4 * 60 * 60 * 1000;
const defaultTtlMs = hour4;
const defaultBatchSize = 200;

const byId = <TResource>(item: TResource): string => (item as { id: string }).id;

/**
 * Store options for the `fetchByIds` strategy.
 *
 * This strategy:
 * - fetches only requested IDs
 * - batches requests (if `batchSize` is set)
 * - dedupes inflight fetches
 * - can negative-cache missing IDs
 */
export interface FetchByIdsStrategyOptions<TResource> {
  /**
   * Fetches resources for the requested IDs.
   *
   * Returned items are keyed by `keyBy` (defaults to `(x as {id}).id`).
   * IDs not returned are treated as missing and resolve to `null`.
   */
  fetchByIds: (ids: string[]) => Awaitable<TResource[]>;

  /**
   * Produces an ID for a fetched resource. Defaults to `(item as { id: string }).id`.
   */
  keyBy?: (item: TResource) => string;

  /**
   * Time-to-live for cached entries (milliseconds). Default: 4 hours.
   */
  ttlMs?: number;

  /**
   * Max IDs per `fetchByIds` call. Default: 200.
   */
  batchSize?: number;

  /**
   * Optional persistent cache for positive/negative entries.
   */
  cache?: ReferenceCache<TResource>;
}

/**
 * Store options for the `fetchAll` strategy.
 *
 * This strategy:
 * - periodically refreshes a full collection (`fetchAll`)
 * - serves `resolve(ids)` from an in-memory map
 * - can warm up from a persistent cache
 */
export interface FetchAllStrategyOptions<TResource> {
  /**
   * Fetches the full resource collection.
   */
  fetchAll: () => Awaitable<TResource[]>;

  /**
   * Produces an ID for a fetched resource. Defaults to `(item as { id: string }).id`.
   */
  keyBy?: (item: TResource) => string;

  /**
   * Time-to-live for cached entries (milliseconds). Default: 4 hours.
   */
  ttlMs?: number;

  /**
   * Optional persistent cache for positive/negative entries.
   */
  cache?: ReferenceCache<TResource>;
}

/**
 * Union of supported store strategies (`fetchByIds` or `fetchAll`).
 */
export type ResourceStoreOptions<TResource> = FetchByIdsStrategyOptions<TResource> | FetchAllStrategyOptions<TResource>;

/**
 * Internal store used by sources created through `SourcesBuilderContext.source(...)`.
 *
 * You usually don't construct it directly; it's exposed as `ResourceStore` for advanced usage.
 */
export class ReferenceStore<TResource> implements Source<TResource> {
  private constructor(private readonly strategy: ResourceStoreStrategy<TResource>) {}

  /**
   * Creates a store from either `fetchAll` or `fetchByIds` options.
   */
  static from<TResource>(options: ResourceStoreOptions<TResource>): ReferenceStore<TResource> {
    const cache = options.cache ?? null;
    const keyBy = options.keyBy ?? byId<TResource>;
    const ttlMs = options.ttlMs ?? defaultTtlMs;

    const strategy =
      'fetchAll' in options
        ? FetchAllStrategy.new({
            cache,
            keyBy,
            ttlMs,
            fetchAll: options.fetchAll,
          })
        : FetchByIdsStrategy.new({
            cache,
            keyBy,
            ttlMs,
            batchSize: options.batchSize ?? defaultBatchSize,
            fetchByIds: options.fetchByIds,
          });

    return new ReferenceStore(strategy);
  }

  resolve(ids: string[]): Awaitable<Map<string, TResource | null>> {
    return this.strategy.resolve(ids);
  }

  invalidate(ids?: string[]): Promise<void> {
    return this.strategy.invalidate(ids);
  }

  clearAll(): Promise<void> {
    return this.strategy.clearAll();
  }
}
