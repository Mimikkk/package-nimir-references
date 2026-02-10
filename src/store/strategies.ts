import { FcNoop } from '../common.ts';
import type { NegativeEntry, NegativeReason, ResourceCache } from '../referenceCache.ts';

export function readHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const direct = (error as Record<string, unknown>).status;
  if (typeof direct === 'number') return direct;

  const response = (error as Record<string, unknown>).response;
  if (typeof response !== 'object' || response === null) return undefined;

  const nested = (response as Record<string, unknown>).status;
  return typeof nested === 'number' ? nested : undefined;
}

export function statusToNegativeReason(status: number): NegativeReason {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status >= 500) return 'internal-server-error';
  return 'missing';
}

export interface ResourceStoreStrategy<TResource> {
  resolve(ids: string[]): Promise<Map<string, TResource | null>>;
  invalidate(ids?: string[]): Promise<void>;
  clearAll(): Promise<void>;
}

export interface SharedOptions<TResource> {
  cache: ResourceCache<TResource> | null;
  keyBy: (item: TResource) => string;
  ttlMs: number;
}

export interface FetchByIdsOptions<TResource> extends SharedOptions<TResource> {
  batchSize: number;
  fetchByIds: (ids: string[]) => TResource[] | Promise<TResource[]>;
}

export interface FetchAllOptions<TResource> extends SharedOptions<TResource> {
  fetchAll: () => TResource[] | Promise<TResource[]>;
}

export class FetchAllStrategy<TResource> implements ResourceStoreStrategy<TResource> {
  private warmup: Promise<void> | null = null;
  private timestampMs = 0;
  private readonly positives = new Map<string, TResource>();
  private readonly negatives = new Map<string, NegativeEntry>();

  private constructor(
    private readonly cache: ResourceCache<TResource> | null,
    private readonly keyBy: (item: TResource) => string,
    private readonly ttlMs: number,
    private readonly fetchAll: () => TResource[] | Promise<TResource[]>,
  ) {}

  static new<TResource>(options: FetchAllOptions<TResource>): FetchAllStrategy<TResource> {
    return new FetchAllStrategy(options.cache, options.keyBy, options.ttlMs, options.fetchAll);
  }

  async resolve(ids: string[]): Promise<Map<string, TResource | null>> {
    await this.ensureWarmUp();

    if (this.timestampMs > 0 && Date.now() - this.timestampMs > this.ttlMs) {
      this.warmup = null;
      void this.ensureWarmUp().catch(FcNoop);
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
      return;
    }

    this.positives.clear();
    this.negatives.clear();
    this.warmup = null;
    this.timestampMs = 0;
    await this.cache?.clear().catch(FcNoop);
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
    if (this.cache) {
      const { positive, negative } = await this.cache.all(this.ttlMs);
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

    const entries: [string, TResource][] = [];
    for (const item of items) {
      const id = this.keyBy(item);
      this.positives.set(id, item);
      entries.push([id, item]);
    }

    void this.cache?.storePositives(entries).catch(FcNoop);
    this.timestampMs = Date.now();
  }
}

export class FetchByIdsStrategy<TResource> implements ResourceStoreStrategy<TResource> {
  private readonly positives = new Map<string, TResource>();
  private readonly negatives = new Map<string, NegativeEntry>();
  private readonly inflight = new Map<string, Promise<TResource | null>>();

  private constructor(
    private readonly cache: ResourceCache<TResource> | null,
    private readonly keyBy: (item: TResource) => string,
    private readonly ttlMs: number,
    private readonly batchSize: number,
    private readonly fetchByIds: (ids: string[]) => TResource[] | Promise<TResource[]>,
  ) {}

  static new<TResource>(options: FetchByIdsOptions<TResource>): FetchByIdsStrategy<TResource> {
    return new FetchByIdsStrategy(options.cache, options.keyBy, options.ttlMs, options.batchSize, options.fetchByIds);
  }

  async resolve(ids: string[]): Promise<Map<string, TResource | null>> {
    const result = new Map<string, TResource | null>();
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
      return;
    }

    this.positives.clear();
    this.negatives.clear();
    await this.cache?.clear().catch(FcNoop);
  }

  async clearAll(): Promise<void> {
    this.positives.clear();
    this.negatives.clear();
    this.inflight.clear();
    await this.cache?.clear();
  }

  private async fetchAndCache(ids: string[]): Promise<Map<string, TResource | null>> {
    const deferreds = new Map<string, (value: TResource | null) => void>();
    for (const id of ids) {
      this.inflight.set(id, new Promise<TResource | null>(resolve => deferreds.set(id, resolve)));
    }

    const result = new Map<string, TResource | null>();

    try {
      let remaining = ids;
      if (this.cache) {
        remaining = await this.drainFromCache(remaining, result, deferreds);
      }
      if (remaining.length > 0) {
        await this.fetchFromNetwork(remaining, result, deferreds);
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

  private async drainFromCache(
    ids: string[],
    result: Map<string, TResource | null>,
    deferreds: Map<string, (value: TResource | null) => void>,
  ): Promise<string[]> {
    const positives = await this.cache!.positives(ids, this.ttlMs);
    const afterPositive: string[] = [];

    for (const id of ids) {
      const item = positives.get(id);
      if (item !== undefined) {
        this.positives.set(id, item);
        result.set(id, item);
        deferreds.get(id)?.(item);
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
        deferreds.get(id)?.(null);
      } else {
        remaining.push(id);
      }
    }

    return remaining;
  }

  private async fetchFromNetwork(
    ids: string[],
    result: Map<string, TResource | null>,
    deferreds: Map<string, (value: TResource | null) => void>,
  ): Promise<void> {
    const items = await this.batchFetch(ids);
    const fetchedIds = new Set<string>();
    const entries: [string, TResource][] = [];

    for (const item of items) {
      const id = this.keyBy(item);
      fetchedIds.add(id);
      this.positives.set(id, item);
      result.set(id, item);
      deferreds.get(id)?.(item);
      entries.push([id, item]);
    }

    if (this.cache && entries.length > 0) {
      void this.cache.storePositives(entries).catch(FcNoop);
    }

    const missing = ids.filter(id => !fetchedIds.has(id));
    this.applyNegative(missing, 'missing', result, deferreds);
  }

  private applyNegative(
    ids: string[],
    reason: NegativeReason,
    result: Map<string, TResource | null>,
    deferreds: Map<string, (value: TResource | null) => void>,
  ): void {
    if (ids.length === 0) return;
    const expiry = Date.now() + this.ttlMs;

    for (const id of ids) {
      this.negatives.set(id, { reason, expiry });
      result.set(id, null);
      deferreds.get(id)?.(null);
    }

    void this.cache?.storeNegatives(ids, reason, this.ttlMs).catch(FcNoop);
  }

  private handleFetchError(
    error: unknown,
    ids: string[],
    result: Map<string, TResource | null>,
    deferreds: Map<string, (value: TResource | null) => void>,
  ): void {
    const unresolved = ids.filter(id => !result.has(id));
    const status = readHttpStatus(error);

    if (!status) {
      for (const id of unresolved) {
        deferreds.get(id)?.(null);
      }
      throw error;
    }

    const reason = statusToNegativeReason(status);
    this.applyNegative(unresolved, reason, result, deferreds);
  }

  private async batchFetch(ids: string[]): Promise<TResource[]> {
    if (!this.batchSize || ids.length <= this.batchSize) {
      return this.fetchByIds(ids);
    }

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += this.batchSize) {
      chunks.push(ids.slice(i, i + this.batchSize));
    }

    const results = await Promise.all(chunks.map(chunk => this.fetchByIds(chunk)));
    return results.flat();
  }
}
