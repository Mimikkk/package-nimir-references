import { isNil, type Fn } from './common.ts';
import { FnAwait } from './defineReferences.ts';
import { ReferenceResolver } from './referenceResolver.ts';
import type { RefFields, Resolve, Source, SourceRegistry } from './types.ts';

export class API<TSources extends SourceRegistry> {
  protected constructor(
    private readonly stores: ReadonlyMap<string, Source>,
    private readonly resolver: ReferenceResolver<TSources>,
  ) {}

  static from<TSources extends SourceRegistry>(
    stores: ReadonlyMap<string, Source>,
    resolver: ReferenceResolver<TSources>,
  ): API<TSources> {
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

  invalidate(source: Extract<keyof TSources, string>, ids?: string[]): void {
    this.stores.get(source)?.invalidate(ids);
  }

  async clear(): Promise<void> {
    await Promise.all(Array.from(this.stores.values()).map(store => store.invalidate()));
  }
}

export interface ResolveOptions<
  TData,
  TFields extends RefFields<TData, TSources>,
  TSources extends SourceRegistry,
  TResult = Resolve<TData, TSources, TFields>,
> {
  fields: TFields;
  transform?: (result: Resolve<TData, TSources, TFields>) => TResult;
}
