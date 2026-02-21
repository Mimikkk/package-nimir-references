import { isNil, type Fn, type FnAwait, type NilOf } from '../../core/common.ts';
import { createReferenceContext, type ReferenceContext, type SourcesContext } from '../../core/defineReferences.ts';
import type { ReferenceResolver, ResolveSyncResult } from '../../core/referenceResolver.ts';
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
    private readonly stores: ReadonlyMap<string, Source>,
    private readonly resolver: ReferenceResolver<TSources>,
  ) {}

  static fromContext<TSources extends SourceRegistry>({
    stores,
    resolver,
  }: ReferenceContext<TSources>): Refs<TSources> {
    return new this(stores, resolver);
  }

  inlineSync<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): ResolveSyncResult<TResult | NilOf<TData>> {
    if (isNil(data)) return { status: 'ok', result: data };
    const resolved = this.resolver.resolveSync(data, options.fields);
    if (resolved.status !== 'ok') return resolved;
    return { status: 'ok', result: options.transform?.(resolved.result) ?? (resolved.result as TResult) };
  }

  async inline<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): Promise<TResult | NilOf<TData>> {
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
  ): (...params: Parameters<TFn>) => Promise<TResult | NilOf<FnAwait<TFn>>> {
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
  return Refs.fromContext(createReferenceContext(sources));
}

export type SourcesOf<TRefs extends Refs<any>> =
  TRefs extends Refs<infer TSources extends SourceRegistry> ? TSources : never;

export type ResolveOf<TType extends Fn> = TType extends (...params: any[]) => Promise<infer TData> ? TData : never;
