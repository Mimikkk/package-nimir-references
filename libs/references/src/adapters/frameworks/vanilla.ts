import { isNil, type Fn, type FnAwait } from '../../core/common.ts';
import { createReferenceContext, type SourcesContext } from '../../core/defineReferences.ts';
import type { ReferenceResolver } from '../../core/referenceResolver.ts';
import type { RefFields, Resolve, Source, SourceRegistry } from '../../core/types.ts';

export interface ResolveOptions<
  TData,
  TFields extends RefFields<TData, TSources>,
  TSources extends SourceRegistry,
  TResult = Resolve<TData, TSources, TFields>,
> {
  fields: TFields;
  transform?: (result: Resolve<TData, TSources, TFields>) => TResult;
}

export class Refs<TSources extends SourceRegistry> {
  protected constructor(
    protected readonly stores: ReadonlyMap<string, Source>,
    protected readonly resolver: ReferenceResolver<TSources>,
  ) {}

  static from<TSources extends SourceRegistry>(
    stores: ReadonlyMap<string, Source>,
    resolver: ReferenceResolver<TSources>,
  ): Refs<TSources> {
    return new this(stores, resolver);
  }

  async inline<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): Promise<TResult | Extract<TData, undefined | null>> {
    if (isNil(data)) return data;
    const resolved = await this.resolver.resolve(data, options.fields);
    return options.transform?.(resolved) ?? (resolved as TResult);
  }

  fn<
    TFn extends Fn,
    TFields extends RefFields<FnAwait<TFn>, TSources>,
    TResult = Resolve<FnAwait<TFn>, TSources, TFields>,
  >(
    fn: TFn,
    options: ResolveOptions<FnAwait<TFn>, TFields, TSources, TResult>,
  ): (...params: Parameters<TFn>) => Promise<TResult | Extract<FnAwait<TFn>, undefined | null>> {
    const self = this;

    return async function resolve(...params) {
      return self.inline(await fn(...params), options);
    };
  }

  async invalidate(source: Extract<keyof TSources, string>, ids?: string[]): Promise<void> {
    return await this.stores.get(source)?.invalidate(ids);
  }

  async restore(): Promise<void> {
    await Promise.all(Array.from(this.stores.values()).map(s => s.restore()));
  }

  async clear(): Promise<void> {
    await Promise.all(Array.from(this.stores.values()).map(s => s.invalidate()));
  }
}

export function defineReferences<TSources extends SourceRegistry>(
  sources: (context: SourcesContext) => TSources,
): Refs<TSources> {
  const { stores, resolver } = createReferenceContext(sources);

  return Refs.from(stores, resolver);
}

export type SourcesOf<TRefs extends Refs<any>> =
  TRefs extends Refs<infer TSources extends SourceRegistry> ? TSources : never;

export type ResolveOf<TType extends Fn> = TType extends (...params: any[]) => Promise<infer TData> ? TData : never;
