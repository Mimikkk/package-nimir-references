import { type Fn } from './common.ts';

import { SourceResolver } from './resolver.ts';
import { SourceStore } from './store.ts';
import type { References, RefFields, ResolvedFn, Source, SourceRegistry, SourcesBuilderContext } from './types.ts';

import type { SourceOptions } from './store.ts';
export type { ResolveOf } from './types.ts';

const builder: SourcesBuilderContext = {
  source<T>(options: SourceOptions<T>): Source<T> {
    return { options } as unknown as Source<T>;
  },
};

export function defineReferences<TSources extends SourceRegistry>(
  sources: (context: SourcesBuilderContext) => TSources,
): References<TSources> {
  type TFields = RefFields<unknown, TSources>;
  const registry = sources(builder);

  const stores = new Map<string, SourceStore>();
  for (const [name, source] of Object.entries(registry)) {
    const options = (source as unknown as Record<string, unknown>).options as SourceOptions<unknown>;
    stores.set(name, SourceStore.from({ ...options, name }));
  }

  const resolver = SourceResolver.from(stores);

  const fn: References<TSources>['fn'] = (fn, options) => {
    return asFn(fn, options.fields as TFields, options.transform, resolver) as never;
  };

  const inline: References<TSources>['inline'] = ((
    item: unknown,
    options: { fields: TFields; transform?: (v: any) => any },
  ) => {
    return resolver.resolve(item, options.fields).then(v => options.transform?.(v) ?? v);
  }) as never;

  const invalidate: References<TSources>['invalidate'] = (source, ids) => {
    const store = stores.get(source);
    if (store) store.invalidate(ids);
  };

  const clear: References<TSources>['clear'] = async () => {
    await Promise.all(Array.from(stores.values()).map(s => s.clearAll()));
  };

  return { fn, inline, invalidate, clear };
}

function asFn<
  TFn extends Fn,
  TFields extends RefFields<NoInfer<ReturnType<TFn>>, NoInfer<TSources>>,
  TSources extends SourceRegistry,
>(
  fn: TFn,
  fields: TFields,
  transform: ((v: any) => any) | undefined,
  resolver: SourceResolver,
): ResolvedFn<TFn, TSources, TFields> {
  return async function resolve(...params) {
    const value = await resolver.resolve(await fn(...params), fields as never);
    return transform?.(value) ?? value;
  };
}
