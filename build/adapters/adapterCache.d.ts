/**
 * Minimal async key-value store interface used by `ReferenceCache`.
 *
 * Implementations are provided as adapters (e.g. in-memory, IndexedDB).
 */
export interface AdapterCache<TValue> {
    /**
     * Returns all entries in the cache.
     *
     * Used for warmup in the `fetchAll` strategy.
     */
    entries(): Promise<[string, TValue][]>;
    /**
     * Reads multiple keys at once.
     *
     * Missing keys should yield `undefined` at the matching index.
     */
    getMany(keys: string[]): Promise<(TValue | undefined)[]>;
    /**
     * Writes multiple entries at once.
     */
    setMany(entries: [key: string, item: TValue][]): Promise<void>;
    /**
     * Deletes multiple keys at once.
     */
    delMany(keys: string[]): Promise<void>;
    /**
     * Clears the entire cache namespace.
     */
    clear(): Promise<void>;
}
