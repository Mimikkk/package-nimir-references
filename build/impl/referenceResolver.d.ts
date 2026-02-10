import { RefFields, Resolve, Source, SourceRegistry } from './types.ts';
export declare class ReferenceResolver<TSources extends SourceRegistry> {
    private readonly sources;
    private constructor();
    /**
     * Creates a resolver from a map of named sources.
     *
     * Most users should not instantiate this directly; use `defineReferences(...)`.
     */
    static from<TSources extends SourceRegistry>(sources: ReadonlyMap<Extract<keyof TSources, string>, Source>): ReferenceResolver<TSources>;
    /**
     * Resolves references described by `fields` on `item`.
     *
     * Behavior:
     * - Returns a clone (does not mutate `item`).
     * - Adds `T` / `Ts` properties next to reference ID fields.
     * - Missing IDs (not returned by the source) resolve to `null`.
     * - `null` / `undefined` IDs resolve to `null` in the corresponding `T`/`Ts` slot.
     * - Unknown source names are skipped (no throw).
     *
     * Depth:
     * - Resolution is bounded by `maxDepth` to avoid infinite loops on circular configs.
     */
    resolve<TData, TFields extends RefFields<TData, TSources>>(item: TData, fields: TFields): Promise<Resolve<TData, TSources, TFields> | Extract<TData, null | undefined>>;
    private collect;
}
