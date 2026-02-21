import type { Awaitable } from './common.ts';
import { readHttpStatus, statusToNegativeReason } from './httpErrors.ts';
import type { NegativeEntry, NegativeReason, ReferenceCache } from './referenceCache.ts';

export interface SourceStrategy<TResource> {
  resolveSync(ids: string[]): Map<string, TResource | null> | null;
  resolve(ids: string[]): Promise<Map<string, TResource | null>>;
  invalidate(ids?: string[]): Promise<void>;
  restore(): Promise<void>;
}

export interface StrategyOptions<TResource> {
  cache: ReferenceCache<TResource> | null;
  keyBy: (item: TResource) => string;
  ttlMs: number;
}

export interface CompleteSourceStrategyOptions<TResource> extends StrategyOptions<TResource> {
  list: () => Awaitable<TResource[]>;
}

export class CompleteSourceStrategy<TResource> implements SourceStrategy<TResource> {
  private fetchRef: Promise<void> | null = null;
  private timestampMs = 0;

  private constructor(
    private readonly positives: Map<string, TResource>,
    private readonly cache: ReferenceCache<TResource> | null,
    private readonly keyBy: (item: TResource) => string,
    private readonly ttlMs: number,
    private readonly fetchAll: () => Awaitable<TResource[]>,
  ) {}

  static new<TResource>(options: CompleteSourceStrategyOptions<TResource>): CompleteSourceStrategy<TResource> {
    return new CompleteSourceStrategy(new Map(), options.cache, options.keyBy, options.ttlMs, options.list);
  }

  async resolve(ids: string[]): Promise<Map<string, TResource | null>> {
    await this.restore();

    if (this.timestampMs > 0 && Date.now() - this.timestampMs > this.ttlMs) {
      this.timestampMs = 0;
      this.fetchRef = null;
      await this.restore();
    }

    return new Map(ids.map(id => [id, this.positives.get(id) ?? null]));
  }

  resolveSync(ids: string[]): Map<string, TResource | null> | null {
    if (this.timestampMs === 0) return null;
    return new Map(ids.map(id => [id, this.positives.get(id) ?? null]));
  }

  async invalidate(ids?: string[]): Promise<void> {
    if (ids) {
      for (const id of ids) {
        this.positives.delete(id);
      }

      await this.cache?.remove(ids);
      return;
    }

    this.positives.clear();
    this.fetchRef = null;
    this.timestampMs = 0;
    await this.cache?.clear();
  }

  async restore(): Promise<void> {
    this.fetchRef ??= this.fetch().catch(error => {
      this.fetchRef = null;
      throw error;
    });

    return this.fetchRef;
  }

  private async fetch(): Promise<void> {
    if (this.cache) {
      const { positive } = await this.cache.all(this.ttlMs);

      if (positive.size > 0) {
        for (const [id, item] of positive) this.positives.set(id, item);
        this.timestampMs = Date.now();
        return;
      }
    }

    const items = await this.fetchAll();
    this.positives.clear();

    const entries: [string, TResource][] = [];

    for (const item of items) {
      const id = this.keyBy(item);
      this.positives.set(id, item);
      entries.push([id, item]);
    }

    this.cache?.storePositives(entries);
    this.timestampMs = Date.now();
  }
}

export interface PartialSourceStrategyOptions<TResource> extends StrategyOptions<TResource> {
  batchSize: number;
  batch: (ids: string[]) => Awaitable<TResource[]>;
}

export class PartialSourceStrategy<TResource> implements SourceStrategy<TResource> {
  private readonly positives = new Map<string, TResource>();
  private readonly negatives = new Map<string, NegativeEntry>();
  private readonly inflight = new Map<string, Promise<TResource | null>>();

  private constructor(
    private readonly cache: ReferenceCache<TResource> | null,
    private readonly keyBy: (item: TResource) => string,
    private readonly ttlMs: number,
    private readonly batchSize: number,
    private readonly batch: (ids: string[]) => Awaitable<TResource[]>,
  ) {}

  static new<TResource>(options: PartialSourceStrategyOptions<TResource>): PartialSourceStrategy<TResource> {
    return new PartialSourceStrategy(options.cache, options.keyBy, options.ttlMs, options.batchSize, options.batch);
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

  resolveSync(ids: string[]): Map<string, TResource | null> | null {
    const result = new Map<string, TResource | null>();
    for (const id of ids) {
      const cached = this.positives.get(id);
      if (cached !== undefined) {
        result.set(id, cached);
        continue;
      }
      const neg = this.negatives.get(id);
      if (neg && Date.now() < neg.expiry) {
        result.set(id, null);
        continue;
      }
      return null;
    }
    return result;
  }

  async invalidate(ids?: string[]): Promise<void> {
    if (ids) {
      for (const id of ids) {
        this.positives.delete(id);
        this.negatives.delete(id);
        this.inflight.delete(id);
      }
      await this.cache?.remove(ids);
      return;
    }

    this.positives.clear();
    this.negatives.clear();
    this.inflight.clear();
    await this.cache?.clear();
  }

  async restore(): Promise<void> {
    if (!this.cache) return;
    const { positive, negative } = await this.cache.all(this.ttlMs);
    for (const [id, item] of positive) this.positives.set(id, item);
    for (const [id, entry] of negative) this.negatives.set(id, entry);
  }

  private async fetchAndCache(ids: string[]): Promise<Map<string, TResource | null>> {
    const deferreds = new Map<string, (value: TResource | null) => void>();
    for (const id of ids) {
      this.inflight.set(id, new Promise<TResource | null>(resolve => deferreds.set(id, resolve)));
    }

    const result = new Map<string, TResource | null>();

    try {
      const { hits, misses } = await this.resolveFromCache(ids);
      this.mergeAndStore(hits, result, deferreds);
      await this.fetchMissed(misses, result, deferreds);
    } catch (error) {
      this.handleFetchError(error, ids, result, deferreds);
    } finally {
      for (const id of ids) {
        this.inflight.delete(id);
      }
    }

    return result;
  }

  private async resolveFromCache(ids: string[]): Promise<{ hits: Map<string, TResource | null>; misses: string[] }> {
    if (!this.cache || ids.length === 0) {
      return { hits: new Map(), misses: ids };
    }

    const hits = new Map<string, TResource | null>();
    const positives = await this.cache.positives(ids, this.ttlMs);
    const unresolved: string[] = [];

    for (const id of ids) {
      const item = positives.get(id);
      if (item !== undefined) {
        this.positives.set(id, item);
        hits.set(id, item);
        continue;
      }
      unresolved.push(id);
    }

    if (unresolved.length === 0) {
      return { hits, misses: [] };
    }

    const negatives = await this.cache.negatives(unresolved);
    const misses: string[] = [];

    for (const id of unresolved) {
      const entry = negatives.get(id);
      if (!entry) {
        misses.push(id);
        continue;
      }
      this.negatives.set(id, entry);
      hits.set(id, null);
    }

    return { hits, misses };
  }

  private mergeAndStore(
    values: Map<string, TResource | null>,
    result: Map<string, TResource | null>,
    deferreds: Map<string, (value: TResource | null) => void>,
  ): void {
    for (const [id, value] of values) {
      result.set(id, value);
      deferreds.get(id)?.(value);
    }
  }

  private async fetchMissed(
    ids: string[],
    result: Map<string, TResource | null>,
    deferreds: Map<string, (value: TResource | null) => void>,
  ): Promise<void> {
    if (ids.length === 0) return;

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
      this.cache.storePositives(entries);
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

    this.cache?.storeNegatives(ids, reason, this.ttlMs);
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
      return this.batch(ids);
    }

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += this.batchSize) {
      chunks.push(ids.slice(i, i + this.batchSize));
    }

    const results = await Promise.all(chunks.map(chunk => this.batch(chunk)));
    return results.flat();
  }
}
