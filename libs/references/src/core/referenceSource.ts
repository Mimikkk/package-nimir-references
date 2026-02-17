import { Awaitable } from './common.ts';
import type { ReferenceCache } from './referenceCache.ts';
import { CompleteSourceStrategy, PartialSourceStrategy, SourceStrategy } from './strategies.ts';
import type { Source } from './types.ts';

const hour4 = 4 * 60 * 60 * 1000;
const defaultTtlMs = hour4;
const defaultBatchSize = 200;

const byId = <TResource>(item: TResource): string => (item as { id: string }).id;

export interface ResolveOptions<TResource> {
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
 * Store options for the `fetchByIds` strategy.
 *
 * This strategy:
 * - fetches only requested IDs
 * - batches requests (if `batchSize` is set)
 * - dedupes inflight fetches
 * - can negative-cache missing IDs
 */
export interface PartialStrategyOptions<TResource> extends ResolveOptions<TResource> {
  /**
   * Fetches resources for the requested IDs.
   *
   * Returned items are keyed by `keyBy` (defaults to `(x as {id}).id`).
   * IDs not returned are treated as missing and resolve to `null`.
   */
  batch: (ids: string[]) => Awaitable<TResource[]>;
  /**
   * Max IDs per `batch` call. Default: 200.
   */
  batchSize?: number;
}

/**
 * Store options for the `fetchAll` strategy.
 *
 * This strategy:
 * - periodically refreshes a full collection (`fetchAll`)
 * - serves `resolve(ids)` from an in-memory map
 * - can warm up from a persistent cache
 */
export interface CompleteStrategyOptions<TResource> extends ResolveOptions<TResource> {
  /**
   * Fetches the full resource collection.
   */
  list: () => Awaitable<TResource[]>;
}

export type ResourceSourceOptions<TResource> = PartialStrategyOptions<TResource> | CompleteStrategyOptions<TResource>;

export class ReferenceSource<TResource> implements Source<TResource> {
  private constructor(private readonly strategy: SourceStrategy<TResource>) {}

  static from<TResource>(options: ResourceSourceOptions<TResource>): ReferenceSource<TResource> {
    const cache = options.cache ?? null;
    const keyBy = options.keyBy ?? byId<TResource>;
    const ttlMs = options.ttlMs ?? defaultTtlMs;

    const strategy =
      'list' in options
        ? CompleteSourceStrategy.new({
            cache,
            keyBy,
            ttlMs,
            list: options.list,
          })
        : PartialSourceStrategy.new({
            cache,
            keyBy,
            ttlMs,
            batchSize: options.batchSize ?? defaultBatchSize,
            batch: options.batch,
          });

    return new ReferenceSource(strategy);
  }

  async resolve(ids: string[]): Promise<Map<string, TResource | null>> {
    return await this.strategy.resolve(ids);
  }

  resolveSync(ids: string[]): Map<string, TResource | null> | null {
    return this.strategy.resolveSync(ids);
  }

  async restore(): Promise<void> {
    return await this.strategy.restore();
  }

  async invalidate(ids?: string[]): Promise<void> {
    return await this.strategy.invalidate(ids);
  }
}
