import { Fn } from './common.ts';
import { ResourceStoreOptions } from './store/resourceStore.ts';
import { RefFields, Resolve, Source, SourceRegistry } from './types.ts';
type FnAwait<TFn extends Fn> = Awaited<ReturnType<TFn>>;
/**
 * Type of a resolved wrapper around an async function.
 *
 * This is the return type of `references.fn(...)`.
 */
export interface ResolveFn<TFn extends Fn, TSources extends SourceRegistry, TFields extends RefFields<FnAwait<TFn>, TSources>> {
    (...params: Parameters<TFn>): Promise<Resolve<FnAwait<TFn>, TSources, TFields>>;
}
/**
 * Extracts the resolved data type from an async function type.
 *
 * Useful when you want the payload type without calling the function.
 */
export type ResolveOf<TType extends (...params: any[]) => Promise<any>> = TType extends (...params: any[]) => Promise<infer TData> ? TData : never;
/**
 * A references resolver instance created by `defineReferences`.
 *
 * It can resolve references either:
 * - directly on a value (`inline`)
 * - by wrapping an async function (`fn`)
 *
 * Resolution adds `T`/`Ts`-suffixed properties next to the original ID fields.
 */
export interface References<TSources extends SourceRegistry> {
    /**
     * Resolves references in a value and returns a cloned result.
     *
     * - Does not mutate the input.
     * - If `data` is `null`/`undefined`, it is returned as-is.
     */
    inline<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(data: TData, options: {
        fields: TFields;
        transform?: (result: Resolve<TData, TSources, TFields>) => TResult;
    }): Promise<TResult | Extract<TData, null | undefined>>;
    /**
     * Wraps an async function and resolves references in its returned value.
     *
     * If the function returns `null`/`undefined`, it is returned as-is.
     */
    fn<TFn extends Fn, TFields extends RefFields<FnAwait<TFn>, TSources>, TResult = Resolve<FnAwait<TFn>, TSources, TFields>>(fn: TFn, options: {
        fields: TFields;
        transform?: (result: Resolve<FnAwait<TFn>, TSources, TFields>) => TResult;
    }): (...params: Parameters<TFn>) => Promise<TResult | Extract<FnAwait<TFn>, null | undefined>>;
    /**
     * Invalidates one source cache, optionally for specific IDs.
     *
     * This impacts the internal store cache (and any configured persistent cache).
     */
    invalidate(source: Extract<keyof TSources, string>, ids?: string[]): void;
    /**
     * Clears all sources (equivalent to invalidating every source).
     */
    clear(): Promise<void>;
}
export interface SourcesBuilderContext {
    /**
     * Creates a source backed by an internal store strategy.
     *
     * Choose one:
     * - `fetchByIds` to fetch the requested IDs (with batching, inflight-dedupe, negative caching).
     * - `fetchAll` to fetch and keep a whole collection (with TTL refresh).
     */
    source<TData>(options: ResourceStoreOptions<TData>): Source<TData>;
}
export declare function defineReferences<TSources extends SourceRegistry>(sources: (context: SourcesBuilderContext) => TSources): References<TSources>;
export {};
