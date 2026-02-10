import { AdapterCache } from './adapterCache.ts';
/**
 * Options for `createMemoryCache`.
 *
 * Currently unused (kept for forwards-compat).
 */
export interface MemoryCacheOptions {
}
declare class MemoryCache<TValue> implements AdapterCache<TValue> {
    private readonly items;
    private constructor();
    static from<TValue>(): MemoryCache<TValue>;
    entries(): Promise<[string, TValue][]>;
    getMany(keys: string[]): Promise<(TValue | undefined)[]>;
    setMany(entries: [key: string, item: TValue][]): Promise<void>;
    delMany(keys: string[]): Promise<void>;
    clear(): Promise<void>;
}
export declare const createMemoryCache: typeof MemoryCache.from;
export {};
