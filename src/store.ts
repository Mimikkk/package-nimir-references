import { FcNoop, Time } from './common.ts';

import type { NegativeEntry, NegativeReason } from './caches/cache.ts';
import { IndexDbCache, ResourceCache } from './caches/cache.ts';

const TtlMs = Time.hour4;

interface ResourceStoreStrategy<TResource> {
  resolve: (ids: string[]) => Promise<Map<string, TResource | null>>;
  invalidate: (ids?: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

interface SharedOptions<TResource> {
  cache: ResourceCache<TResource> | null;
  keyBy: (item: TResource) => string;
  ttl: number;
}

class FetchAllStrategy<T> implements ResourceStoreStrategy<T> {
  private warmup: Promise<void> | null = null;
  private timestampMs = 0;

  private constructor(
    private readonly positives: Map<string, T>,
    private readonly negatives: Map<string, NegativeEntry>,
    private readonly cache: ResourceCache<T> | null,
    private readonly keyBy: (item: T) => string,
    private readonly ttl: number,
    private readonly fetchAll: () => T[] | Promise<T[]>,
  ) {}

  static from<T>(options: SharedOptions<T> & { fetchAll: () => T[] | Promise<T[]> }): FetchAllStrategy<T> {
    return new FetchAllStrategy(
      new Map<string, T>(),
      new Map<string, NegativeEntry>(),
      options.cache,
      options.keyBy,
      options.ttl,
      options.fetchAll,
    );
  }

  async resolve(ids: string[]): Promise<Map<string, T | null>> {
    await this.ensureWarmUp();

    const ttl = this.ttl;
    if (this.timestampMs > 0 && Date.now() - this.timestampMs > ttl) {
      this.warmup = null;
      this.ensureWarmUp().catch(FcNoop);
    }

    return new Map(ids.map(id => [id, this.positives.get(id) ?? null]));
  }

  async invalidate(ids?: string[]): Promise<void> {
    if (ids) {
      for (const id of ids) {
        this.positives.delete(id);
        this.negatives.delete(id);
      }

      await this.cache?.removeByIds(ids).catch(FcNoop);
    } else {
      this.positives.clear();
      this.negatives.clear();
      this.warmup = null;
      this.timestampMs = 0;
      await this.cache?.clear().catch(FcNoop);
    }
  }

  async clearAll(): Promise<void> {
    this.positives.clear();
    this.negatives.clear();
    this.warmup = null;
    this.timestampMs = 0;
    await this.cache?.clear();
  }

  private ensureWarmUp(): Promise<void> {
    this.warmup ??= this.doWarmUp().catch(error => {
      this.warmup = null;
      throw error;
    });

    return this.warmup;
  }

  private async doWarmUp(): Promise<void> {
    const ttl = this.ttl;

    if (this.cache) {
      const { positive, negative } = await this.cache.all(ttl);

      if (positive.size > 0) {
        for (const [id, item] of positive) this.positives.set(id, item);
        for (const [id, entry] of negative) this.negatives.set(id, entry);
        this.timestampMs = Date.now();

        return;
      }
    }

    const items = await this.fetchAll();
    this.positives.clear();
    this.negatives.clear();

    const entries: [string, T][] = [];
    for (const item of items) {
      const id = this.keyBy(item);
      this.positives.set(id, item);
      entries.push([id, item]);
    }

    this.cache?.storePositives(entries).catch(FcNoop);
    this.timestampMs = Date.now();
  }
}

class FetchByIdsStrategy<T> implements ResourceStoreStrategy<T> {
  private constructor(
    private readonly positives: Map<string, T>,
    private readonly negatives: Map<string, NegativeEntry>,
    private readonly inflight: Map<string, Promise<T | null>>,
    private readonly cache: ResourceCache<T> | null,
    private readonly keyBy: (item: T) => string,
    private readonly ttl: number,
    private readonly batchSize: number,
    private readonly fetch?: (ids: string[]) => T[] | Promise<T[]>,
  ) {}

  static from<T>(options: SharedOptions<T> & { batchSize: number; fetch?: (ids: string[]) => T[] | Promise<T[]> }) {
    return new FetchByIdsStrategy(
      new Map<string, T>(),
      new Map<string, NegativeEntry>(),
      new Map<string, Promise<T | null>>(),
      options.cache,
      options.keyBy,
      options.ttl,
      options.batchSize,
      options.fetch,
    );
  }

  async resolve(ids: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    const joins: Promise<void>[] = [];
    const remaining: string[] = [];

    for (const id of ids) {
      const cached = this.positives.get(id);
      if (cached !== undefined) {
        result.set(id, cached);
        continue;
      }

      const neg = this.negatives.get(id);
      if (neg) {
        if (Date.now() < neg.expiry) {
          result.set(id, null);
          continue;
        }
        this.negatives.delete(id);
      }

      const pending = this.inflight.get(id);
      if (pending) {
        joins.push(pending.then(v => void result.set(id, v)));
        continue;
      }

      remaining.push(id);
    }

    if (remaining.length > 0) {
      const fetched = await this.fetchAndCache(remaining);
      for (const [id, item] of fetched) {
        result.set(id, item);
      }
    }

    if (joins.length > 0) {
      await Promise.all(joins);
    }

    return result;
  }

  async invalidate(ids?: string[]): Promise<void> {
    if (ids) {
      for (const id of ids) {
        this.positives.delete(id);
        this.negatives.delete(id);
      }

      await this.cache?.removeByIds(ids).catch(FcNoop);
    } else {
      this.positives.clear();
      this.negatives.clear();
      await this.cache?.clear().catch(FcNoop);
    }
  }

  async clearAll(): Promise<void> {
    this.positives.clear();
    this.negatives.clear();
    this.inflight.clear();
    await this.cache?.clear();
  }

  private async fetchAndCache(ids: string[]): Promise<Map<string, T | null>> {
    const deferreds = new Map<string, (v: T | null) => void>();
    for (const id of ids) {
      this.inflight.set(id, new Promise<T | null>(resolve => deferreds.set(id, resolve)));
    }

    const result = new Map<string, T | null>();

    try {
      let remaining = ids;

      if (this.cache) {
        remaining = await this.drainFromIdb(remaining, result, deferreds);
      }

      if (remaining.length > 0 && this.fetch) {
        await this.fetchFromNetwork(remaining, result, deferreds);
      } else {
        for (const id of remaining) {
          result.set(id, null);
          deferreds.get(id)?.(null);
        }
      }
    } catch (error) {
      this.handleFetchError(error, ids, result, deferreds);
    } finally {
      for (const id of ids) {
        this.inflight.delete(id);
      }
    }

    return result;
  }

  private async drainFromIdb(
    ids: string[],
    result: Map<string, T | null>,
    deferreds: Map<string, (v: T | null) => void>,
  ): Promise<string[]> {
    const ttl = this.ttl;
    const positives = await this.cache!.positives(ids, ttl);

    const afterPositive: string[] = [];
    for (const id of ids) {
      const item = positives.get(id);
      if (item !== undefined) {
        this.positives.set(id, item);
        result.set(id, item);
        deferreds.get(id)!(item);
      } else {
        afterPositive.push(id);
      }
    }

    if (afterPositive.length === 0) return [];

    const negatives = await this.cache!.negatives(afterPositive);
    const remaining: string[] = [];

    for (const id of afterPositive) {
      const entry = negatives.get(id);
      if (entry) {
        this.negatives.set(id, entry);
        result.set(id, null);
        deferreds.get(id)!(null);
      } else {
        remaining.push(id);
      }
    }

    return remaining;
  }

  private async fetchFromNetwork(
    ids: string[],
    result: Map<string, T | null>,
    deferreds: Map<string, (v: T | null) => void>,
  ): Promise<void> {
    const items = await this.batchFetch(ids);
    const fetchedIds = new Set<string>();
    const entries: [string, T][] = [];

    for (const item of items) {
      const id = this.keyBy(item);
      fetchedIds.add(id);
      this.positives.set(id, item);
      result.set(id, item);
      deferreds.get(id)?.(item);
      entries.push([id, item]);
    }

    if (this.cache && entries.length > 0) {
      this.cache.storePositives(entries).catch(FcNoop);
    }

    const missing = ids.filter(id => !fetchedIds.has(id));
    this.applyNegative(missing, 'missing', result, deferreds);
  }

  private applyNegative(
    ids: string[],
    reason: NegativeReason,
    result: Map<string, T | null>,
    deferreds: Map<string, (v: T | null) => void>,
  ): void {
    if (ids.length === 0) return;

    const ttl = this.ttl;
    const expiry = Date.now() + ttl;

    for (const id of ids) {
      this.negatives.set(id, { reason, expiry });
      result.set(id, null);
      deferreds.get(id)?.(null);
    }

    this.cache?.storeNegatives(ids, reason, ttl).catch(FcNoop);
  }

  private handleFetchError(
    error: unknown,
    ids: string[],
    result: Map<string, T | null>,
    deferreds: Map<string, (v: T | null) => void>,
  ): void {
    const unresolved = ids.filter(id => !result.has(id));
    const status = readHttpStatus(error);

    if (status === 401 || status === 403) {
      this.applyNegative(unresolved, 'unauthorized', result, deferreds);
    } else if (status === 404 || status === 500) {
      this.applyNegative(unresolved, 'not-found', result, deferreds);
    } else if (status && status > 400) {
      this.applyNegative(unresolved, 'internal-server-error', result, deferreds);
    } else if (status) {
      for (const id of unresolved) {
        deferreds.get(id)?.(null);
      }
      throw error;
    }
  }

  private async batchFetch(ids: string[]): Promise<T[]> {
    const batchSize = this.batchSize;
    if (!batchSize || ids.length <= batchSize) {
      return this.fetch!(ids);
    }

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      chunks.push(ids.slice(i, i + batchSize));
    }

    const results = await Promise.all(chunks.map(chunk => this.fetch!(chunk)));
    return results.flat();
  }
}

const byId = <T>(item: T): string => (item as unknown as { id: string }).id;
export class ResourceStore<T = unknown> {
  private constructor(private readonly strategy: ResourceStoreStrategy<T>) {}

  public static from<T>(options: ResourceStoreOptions<T>): ResourceStore<T> {
    const cache = options.cache ? ResourceCache.fromCache<T>(IndexDbCache.fromNames(options.cache, 'test')) : null;
    const keyBy = options.keyBy ?? byId<T>;
    const ttl = options.ttlMs ?? TtlMs;

    const fetchAll = (options as FetchAllStrategyOptions<T>).fetchAll;
    if (fetchAll) {
      return new ResourceStore(FetchAllStrategy.from({ cache: cache as ResourceCache<T>, keyBy, ttl, fetchAll }));
    }

    const fetch = (options as FetchStrategyOptions<T>).fetchByIds;
    const batchSize = (options as FetchStrategyOptions<T>).batchSize ?? 200;
    return new ResourceStore(FetchByIdsStrategy.from({ cache, keyBy, ttl, batchSize, fetch }));
  }

  async resolve(ids: string[]): Promise<Map<string, T | null>> {
    return this.strategy.resolve(ids);
  }

  async invalidate(ids?: string[]): Promise<void> {
    await this.strategy.invalidate(ids);
  }

  async clearAll(): Promise<void> {
    await this.strategy.clearAll();
  }
}

export interface FetchStrategyOptions<TResource> {
  fetchByIds?: (ids: string[]) => TResource[] | Promise<TResource[]>;
  keyBy?: (item: TResource) => string;
  ttlMs?: number;
  batchSize?: number;
  cache?: string;
}

export interface FetchAllStrategyOptions<TResource> {
  fetchAll?: () => TResource[] | Promise<TResource[]>;
  keyBy?: (item: TResource) => string;
  ttlMs?: number;
  cache?: string;
}

export type ResourceStoreOptions<T> = FetchStrategyOptions<T> | FetchAllStrategyOptions<T>;

function readHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const direct = (error as Record<string, unknown>).status;
  if (typeof direct === 'number') return direct;

  const response = (error as Record<string, unknown>).response;
  if (response && typeof response === 'object') {
    const nested = (response as Record<string, unknown>).status;
    if (typeof nested === 'number') return nested;
  }

  return undefined;
}
