import { AdapterCache } from './adapterCache.ts';
declare class IdbKeyvalCache<TValue> implements AdapterCache<TValue> {
    private readonly store;
    private constructor();
    static from<TValue>({ database, table }: IdbKeyvalCacheOptions): IdbKeyvalCache<TValue>;
    entries(): Promise<[string, TValue][]>;
    getMany(keys: string[]): Promise<(TValue | undefined)[]>;
    setMany(entries: [key: string, item: TValue][]): Promise<void>;
    delMany(keys: string[]): Promise<void>;
    clear(): Promise<void>;
}
/**
 * Options for `createIdbKeyvalCache`.
 *
 * `table` is the object store name (passed to `idb-keyval`'s `createStore`).
 */
export interface IdbKeyvalCacheOptions {
    database: string;
    table: string;
}
/**
 * Creates an IndexedDB-backed cache adapter using `idb-keyval`.
 *
 * Use it with `ResourceCache.new(...)` to enable persistence across sessions.
 */
export declare const createIdbKeyvalCache: typeof IdbKeyvalCache.from;
export {};
