import { Awaitable } from '../common.ts';
import { ReferenceCache } from '../referenceCache.ts';
export declare const FcNoop: () => void;
export interface ResourceStoreStrategy<TResource> {
    resolve(ids: string[]): Promise<Map<string, TResource | null>>;
    invalidate(ids?: string[]): Promise<void>;
    clearAll(): Promise<void>;
}
export interface StrategyOptions<TResource> {
    cache: ReferenceCache<TResource> | null;
    keyBy: (item: TResource) => string;
    ttlMs: number;
}
export interface FetchAllOptions<TResource> extends StrategyOptions<TResource> {
    fetchAll: () => Awaitable<TResource[]>;
}
export declare class FetchAllStrategy<TResource> implements ResourceStoreStrategy<TResource> {
    private readonly cache;
    private readonly keyBy;
    private readonly ttlMs;
    private readonly fetchAll;
    private warmup;
    private timestampMs;
    private readonly positives;
    private readonly negatives;
    private constructor();
    static new<TResource>(options: FetchAllOptions<TResource>): FetchAllStrategy<TResource>;
    resolve(ids: string[]): Promise<Map<string, TResource | null>>;
    invalidate(ids?: string[]): Promise<void>;
    clearAll(): Promise<void>;
    private ensureWarmUp;
    private doWarmUp;
}
export interface FetchByIdsOptions<TResource> extends StrategyOptions<TResource> {
    batchSize: number;
    fetchByIds: (ids: string[]) => Awaitable<TResource[]>;
}
export declare class FetchByIdsStrategy<TResource> implements ResourceStoreStrategy<TResource> {
    private readonly cache;
    private readonly keyBy;
    private readonly ttlMs;
    private readonly batchSize;
    private readonly fetchByIds;
    private readonly positives;
    private readonly negatives;
    private readonly inflight;
    private constructor();
    static new<TResource>(options: FetchByIdsOptions<TResource>): FetchByIdsStrategy<TResource>;
    resolve(ids: string[]): Promise<Map<string, TResource | null>>;
    invalidate(ids?: string[]): Promise<void>;
    clearAll(): Promise<void>;
    private fetchAndCache;
    private drainFromCache;
    private fetchFromNetwork;
    private applyNegative;
    private handleFetchError;
    private batchFetch;
}
