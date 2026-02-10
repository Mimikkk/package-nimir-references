import { Awaitable } from '../common.ts';
import type { ReferenceCache } from '../referenceCache.ts';
import type { Source } from '../types.ts';
import { FetchAllStrategy, FetchByIdsStrategy, ResourceStoreStrategy } from './strategies.ts';

const hour4 = 4 * 60 * 60 * 1000;
const defaultTtlMs = hour4;
const defaultBatchSize = 200;

const byId = <TResource>(item: TResource): string => (item as { id: string }).id;

export interface FetchByIdsStrategyOptions<TResource> {
  fetchByIds: (ids: string[]) => Awaitable<TResource[]>;
  keyBy?: (item: TResource) => string;
  ttlMs?: number;
  batchSize?: number;
  cache?: ReferenceCache<TResource>;
}

export interface FetchAllStrategyOptions<TResource> {
  fetchAll: () => Awaitable<TResource[]>;
  keyBy?: (item: TResource) => string;
  ttlMs?: number;
  cache?: ReferenceCache<TResource>;
}

export type ResourceStoreOptions<TResource> = FetchByIdsStrategyOptions<TResource> | FetchAllStrategyOptions<TResource>;

export class ReferenceStore<TResource> implements Source<TResource> {
  private constructor(private readonly strategy: ResourceStoreStrategy<TResource>) {}

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
