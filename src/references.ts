import { type Fn } from './common.ts';

import { SourceResolver } from './resolver.ts';
import { SourceStore } from './store.ts';
import type { RefFields, Resolve, Source, SourceRegistry } from './types.ts';

import type { SourceStoreOptions } from './store.ts';

export type FnAwait<TFn extends Fn> = Awaited<ReturnType<TFn>>;
export interface ResolveFn<
  TFn extends Fn,
  TSources extends SourceRegistry,
  TFields extends RefFields<FnAwait<TFn>, TSources>,
> {
  (...params: Parameters<TFn>): Promise<Resolve<FnAwait<TFn>, TSources, TFields>>;
}

export type ResolveOf<TType extends (...params: any[]) => Promise<any>> = TType extends (
  ...params: any[]
) => Promise<infer TData>
  ? TData
  : never;

class ReferenceResolver<TSources extends SourceRegistry> {
  constructor(
    private readonly stores: ReadonlyMap<string, SourceStore>,
    private readonly resolver: SourceResolver<TSources>,
  ) {
    this.inline = this.inline.bind(this);
    this.fn = this.fn.bind(this);
    this.invalidate = this.invalidate.bind(this);
    this.clear = this.clear.bind(this);
  }

  async inline<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: { fields: TFields; transform?: (result: Resolve<TData, TSources, TFields>) => TResult },
  ): Promise<TResult | Extract<TData, null | undefined>> {
    const resolve = await this.resolver.resolve(data, options.fields);
    if (resolve === null || resolve === undefined) return null!;
    return (options.transform?.(resolve) ?? resolve) as TResult;
  }

  fn<
    TFn extends Fn,
    TFields extends RefFields<FnAwait<TFn>, TSources>,
    TResult = Resolve<FnAwait<TFn>, TSources, TFields>,
  >(
    fn: TFn,
    options: { fields: TFields; transform?: (result: Resolve<FnAwait<TFn>, TSources, TFields>) => TResult },
  ): (...params: Parameters<TFn>) => Promise<TResult | Extract<FnAwait<TFn>, null | undefined>> {
    const resolver = this.resolver;

    return async function resolve(...params) {
      const value = await fn(...params);
      const resolve = await resolver.resolve(value, options.fields);
      if (resolve === null || resolve === undefined) return null!;
      return options.transform?.(resolve) ?? resolve;
    };
  }

  invalidate(source: Extract<keyof TSources, string>, ids?: string[]): void {
    this.stores.get(source)?.invalidate(ids);
  }

  async clear(): Promise<void> {
    await Promise.all(Array.from(this.stores.values()).map(s => s.clearAll()));
  }
}

type SourceOptions<T> = Omit<SourceStoreOptions<T>, 'name'>;

export interface SourcesBuilderContext {
  source<TData>(options: SourceOptions<TData>): Source<TData>;
}

const builder: SourcesBuilderContext = {
  source<TData>(options: SourceOptions<TData>): Source<TData> {
    return options;
  },
};

export function defineReferences<TSources extends SourceRegistry>(
  sources: (context: SourcesBuilderContext) => TSources,
): ReferenceResolver<TSources> {
  const registry = sources(builder);

  const stores = new Map<string, SourceStore>();
  for (const [name, options] of Object.entries(registry)) {
    stores.set(name, SourceStore.from({ ...options, name }));
  }

  const resolver = SourceResolver.from(stores);

  return new ReferenceResolver(stores, resolver);
}
