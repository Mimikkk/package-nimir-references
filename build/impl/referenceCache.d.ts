import { AdapterCache } from '../adapters/adapterCache.ts';
/**
 * Reason why an ID is negatively cached.
 *
 * This is used to avoid repeatedly fetching IDs that are known to be unavailable.
 */
export type NegativeReason = 'not-found' | 'unauthorized' | 'missing' | 'internal-server-error';
/**
 * A cached "negative" entry (represents an ID that should resolve to `null` for some time).
 */
export interface NegativeEntry {
    /**
     * Reason for the negative cache entry.
     */
    reason: NegativeReason;
    /**
     * Epoch milliseconds when this entry expires.
     */
    expiry: number;
}
/**
 * A cached "positive" entry (represents a resolved resource).
 */
export interface PositiveEntry<TResource> {
    resource: TResource;
    /**
     * Epoch milliseconds when the resource was stored.
     */
    updatedAt: number;
}
/**
 * Cache entry stored by `ReferenceCache`.
 */
export type ResourceEntry<TResource> = PositiveEntry<TResource> | NegativeEntry;
export declare class ReferenceCache<TResource> {
    private readonly cache;
    private constructor();
    /**
     * Wraps an adapter implementation into a cache used by stores.
     */
    static new<TResource>(cache: AdapterCache<ResourceEntry<TResource>>): ReferenceCache<TResource>;
    /**
     * Loads the whole cache (adapter `entries()`), partitions into positive/negative and filters by TTL.
     *
     * This is primarily used by the `fetchAll` strategy to warm up quickly.
     */
    all(ttlMs: number): Promise<{
        positive: Map<string, TResource>;
        negative: Map<string, NegativeEntry>;
    }>;
    positives(ids: string[], ttlMs: number): Promise<Map<string, TResource>>;
    negatives(ids: string[]): Promise<Map<string, NegativeEntry>>;
    /**
     * Stores resources as positive entries, with a shared `updatedAt` timestamp.
     */
    storePositives(items: [id: string, data: TResource][]): Promise<void>;
    /**
     * Stores negative entries for IDs (all share the same expiry).
     */
    storeNegatives(ids: string[], reason: NegativeReason, ttlMs: number): Promise<void>;
    /**
     * Removes both positive and negative entries for the given IDs.
     */
    removeByIds(ids: string[]): Promise<void>;
    /**
     * Clears all cache entries.
     */
    clear(): Promise<void>;
}
