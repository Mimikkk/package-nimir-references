import { Time } from '../common.ts';
import type { ResourceCache } from '../referenceCache.ts';
import type { Source } from '../types.ts';
import { FetchAllStrategy, FetchByIdsStrategy } from './strategies.ts';

const defaultTtlMs = Time.hour4;
const defaultBatchSize = 200;

const byId = <TResource>(item: TResource): string => (item as { id: string }).id;

export interface FetchByIdsStrategyOptions<TResource> {
  fetchByIds: (ids: string[]) => TResource[] | Promise<TResource[]>;
  keyBy?: (item: TResource) => string;
  ttlMs?: number;
  batchSize?: number;
  cache?: ResourceCache<TResource> | null;
}

export interface FetchAllStrategyOptions<TResource> {
  fetchAll: () => TResource[] | Promise<TResource[]>;
  keyBy?: (item: TResource) => string;
  ttlMs?: number;
  cache?: ResourceCache<TResource> | null;
}

export type ResourceStoreOptions<TResource> = FetchByIdsStrategyOptions<TResource> | FetchAllStrategyOptions<TResource>;

export class ResourceStore<TResource = unknown> implements Source<TResource> {
  private constructor(private readonly strategy: Source<TResource>) {}

  static new<TResource>(options: ResourceStoreOptions<TResource>): ResourceStore<TResource> {
    const cache = options.cache ?? null;
    const keyBy = options.keyBy ?? byId<TResource>;
    const ttlMs = options.ttlMs ?? defaultTtlMs;

    const strategy: Source<TResource> =
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

    return new ResourceStore(strategy);
  }

  static from<TResource>(options: ResourceStoreOptions<TResource>): ResourceStore<TResource> {
    return ResourceStore.new(options);
  }

  resolve(ids: string[]): Promise<Map<string, TResource | null>> {
    return this.strategy.resolve(ids);
  }

  invalidate(ids?: string[]): Promise<void> {
    return this.strategy.invalidate(ids);
  }

  clearAll(): Promise<void> {
    return this.strategy.clearAll();
  }
}
