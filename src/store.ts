import { FcNoop, Time } from './common.ts';

import type { NegativeEntry, NegativeReason } from './cache.ts';
import { IndexDbCache, SourceCache } from './cache.ts';

const TtlMs = Time.hour4;

export class SourceStore<T = unknown> {
  private warmUpPromise: Promise<void> | null = null;
  private lastWarmUp = 0;

  private constructor(
    private readonly mem = new Map<string, T>(),
    private readonly negCache = new Map<string, NegativeEntry>(),
    private readonly inflight = new Map<string, Promise<T | null>>(),
    private readonly cache: SourceCache<any> | null,
    private readonly keyBy: (item: T) => string,
    private readonly ttl: number,
    private readonly batchSize: number,
    private readonly options: SourceOptions<T>,
  ) {}

  public static from<T>(options: SourceOptions<T>): SourceStore<T> {
    return new SourceStore(
      new Map<string, T>(),
      new Map<string, NegativeEntry>(),
      new Map<string, Promise<T | null>>(),
      options.cache !== false ? SourceCache.fromCache(IndexDbCache.fromNames(options.name, 'test')) : null,
      options.keyBy ?? ((item: any) => item.id),
      options.ttl ?? TtlMs,
      options.batchSize ?? 200,
      options,
    );
  }

  async resolve(ids: string[]): Promise<Map<string, T | null>> {
    if (this.options.fetchAll) return this.resolveFetchAll(ids);
    return this.resolveFetch(ids);
  }

  invalidate(ids?: string[]): void {
    if (ids) {
      for (const id of ids) {
        this.mem.delete(id);
        this.negCache.delete(id);
      }
      this.cache?.clearIds(ids).catch(FcNoop);
    } else {
      this.mem.clear();
      this.negCache.clear();
      this.warmUpPromise = null;
      this.lastWarmUp = 0;
      this.cache?.clear().catch(FcNoop);
    }
  }

  async clearAll(): Promise<void> {
    this.mem.clear();
    this.negCache.clear();
    this.inflight.clear();
    this.warmUpPromise = null;
    this.lastWarmUp = 0;
    await this.cache?.clear();
  }

  private async resolveFetchAll(ids: string[]): Promise<Map<string, T | null>> {
    await this.ensureWarmUp();

    const ttl = this.ttl;
    if (this.lastWarmUp > 0 && Date.now() - this.lastWarmUp > ttl) {
      this.warmUpPromise = null;
      this.ensureWarmUp().catch(FcNoop);
    }

    const result = new Map<string, T | null>();
    for (const id of ids) {
      result.set(id, this.mem.get(id) ?? null);
    }
    return result;
  }

  private ensureWarmUp(): Promise<void> {
    this.warmUpPromise ??= this.doWarmUp().catch(err => {
      this.warmUpPromise = null;
      throw err;
    });
    return this.warmUpPromise;
  }

  private async doWarmUp(): Promise<void> {
    const ttl = this.ttl;

    if (this.cache) {
      const { positive, negative } = await this.cache.read<T>(ttl);
      if (positive.size > 0) {
        for (const [id, item] of positive) this.mem.set(id, item);
        for (const [id, entry] of negative) this.negCache.set(id, entry);
        this.lastWarmUp = Date.now();
        return;
      }
    }

    const items = await this.options.fetchAll!();
    this.mem.clear();
    this.negCache.clear();

    const entries: [string, T][] = [];
    for (const item of items) {
      const id = this.keyBy(item);
      this.mem.set(id, item);
      entries.push([id, item]);
    }

    this.cache?.persistPositives(entries).catch(FcNoop);
    this.lastWarmUp = Date.now();
  }

  private async resolveFetch(ids: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    const joins: Promise<void>[] = [];
    const remaining: string[] = [];

    for (const id of ids) {
      const cached = this.mem.get(id);
      if (cached !== undefined) {
        result.set(id, cached);
        continue;
      }

      const neg = this.negCache.get(id);
      if (neg) {
        if (Date.now() < neg.expiry) {
          result.set(id, null);
          continue;
        }
        this.negCache.delete(id);
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

      if (remaining.length > 0 && this.options.fetch) {
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
    const positives = await this.cache!.readPositives<T>(ids, ttl);

    const afterPositive: string[] = [];
    for (const id of ids) {
      const item = positives.get(id);
      if (item !== undefined) {
        this.mem.set(id, item);
        result.set(id, item);
        deferreds.get(id)!(item);
      } else {
        afterPositive.push(id);
      }
    }

    if (afterPositive.length === 0) return [];

    const negatives = await this.cache!.readNegatives(afterPositive);
    const remaining: string[] = [];

    for (const id of afterPositive) {
      const entry = negatives.get(id);
      if (entry) {
        this.negCache.set(id, entry);
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
      this.mem.set(id, item);
      result.set(id, item);
      deferreds.get(id)?.(item);
      entries.push([id, item]);
    }

    if (this.cache && entries.length > 0) {
      this.cache.persistPositives(entries).catch(FcNoop);
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
      this.negCache.set(id, { reason, expiry });
      result.set(id, null);
      deferreds.get(id)?.(null);
    }

    this.cache?.persistNegatives(ids, reason, ttl).catch(FcNoop);
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
      return this.options.fetch!(ids);
    }

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      chunks.push(ids.slice(i, i + batchSize));
    }

    const results = await Promise.all(chunks.map(chunk => this.options.fetch!(chunk)));
    return results.flat();
  }
}

export interface SourceOptions<T> {
  /** Batch fetch items by IDs. */
  fetch?: (ids: string[]) => Promise<T[]>;
  /** Load entire dataset at once. */
  fetchAll?: () => Promise<T[]>;
  /** Extract ID from an item. Default: `(item) => item.id`. */
  keyBy?: (item: T) => string;
  /** Positive cache TTL in ms. */
  ttl?: number;
  /** Max IDs per `fetch` call. Chunks automatically if exceeded. */
  batchSize?: number;
  /** IDB caching. Default: `true`. */
  cache?: boolean;
  /** IDB database name. */
  name: string;
}

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
