import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { type Fn, type FnAwait, isNil } from '../../core/common.ts';
import { createReferenceContext, type SourcesContext } from '../../core/defineReferences.ts';
import type { ReferenceResolver } from '../../core/referenceResolver.ts';
import type { RefFields, Resolve, Source, SourceRegistry } from '../../core/types.ts';
import { type ResolveOptions, Refs as VanillaRefs } from './vanilla.ts';

/**
 * The status of the data resolution.
 * - 'pending' - Fetch is not yet completed.
 * - 'error' - Fetch ended up with an error.
 * - 'success' - Fetch was successful.
 */
type ResultStatus = 'pending' | 'error' | 'success';

/**
 * The status of the fetch operation.
 * - 'fetching' - Fetch is in progress.
 * - 'idle' - Fetch is not in progress.
 */
type FetchStatus = 'fetching' | 'idle';

interface UseReferencesResult<TResult> {
  /** The error that occurred while fetching the data. */
  error: unknown | undefined;
  /** The fetched data. */
  result: TResult | undefined;
  /** The status of the data resolution. */
  status: ResultStatus;
  /** The status of the fetch operation. */
  fetchStatus: FetchStatus;
  /** Invalidates the data resolution and triggers a new fetch. */
  invalidate: () => Promise<void>;
}

interface UseReferences<
  THook extends Fn,
  TSources extends SourceRegistry,
  TFields extends RefFields<FnAwait<THook>, TSources>,
  TResult = Resolve<FnAwait<THook>, TSources, TFields>,
> {
  (...params: Parameters<THook>): UseReferencesResult<TResult>;
}

function toResult<TData, TSources extends SourceRegistry, TFields extends RefFields<TData, TSources>, TResult>(
  value: Resolve<TData, TSources, TFields> | Extract<TData, undefined | null>,
  transform: ResolveOptions<TData, TFields, TSources, TResult>['transform'],
): TResult | undefined {
  if (isNil(value)) return undefined;
  return transform?.(value as Resolve<TData, TSources, TFields>) ?? (value as TResult);
}

export class Refs<TSources extends SourceRegistry> extends VanillaRefs<TSources> {
  static from<TSources extends SourceRegistry>(
    stores: ReadonlyMap<Extract<keyof TSources, string>, Source>,
    resolver: ReferenceResolver<TSources>,
  ) {
    return new this(stores, resolver);
  }

  hook<
    TUse extends Fn,
    TFields extends RefFields<FnAwait<TUse>, TSources>,
    TResult = Resolve<FnAwait<TUse>, TSources, TFields>,
  >(
    use: TUse,
    options: ResolveOptions<FnAwait<TUse>, TFields, TSources, TResult>,
  ): UseReferences<TUse, TSources, TFields, TResult> {
    const self = this;

    return function useReferences(...params) {
      return self.use(use(...params), options);
    };
  }

  use<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): UseReferencesResult<TResult> {
    const memory = useMemo(() => this.resolver.resolveSync(data, options.fields), [data]);

    const [result, setResult] = useState<TResult | undefined>(() =>
      memory.status === 'ok' ? toResult(memory.result, options.transform) : undefined,
    );
    const [status, setStatus] = useState<ResultStatus>(memory.status === 'ok' ? 'success' : 'pending');
    const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
    const [error, setError] = useState<unknown | undefined>(undefined);
    const versionRef = useRef(0);

    const resolve = useEffectEvent(async () => {
      const version = ++versionRef.current;

      try {
        setFetchStatus('fetching');
        const result = (await this.inline(data, options))!;

        if (versionRef.current === version) {
          setResult(result);
          setError(undefined);
          setStatus('success');
        }
      } catch (error) {
        if (versionRef.current === version) {
          setResult(undefined);
          setError(error);
          setStatus('error');
        }
      } finally {
        if (versionRef.current === version) {
          setFetchStatus('idle');
        }
      }
    });

    const invalidate = useCallback(() => resolve(), []);

    useEffect(() => {
      if (memory.status === 'ok') {
        setResult(toResult(memory.result, options.transform));
        setStatus('success');
        return;
      }

      resolve();
    }, [data]);

    return { result, error, status, fetchStatus, invalidate };
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

export type ResolveOf<TType extends Fn> = TType extends (
  ...params: any[]
) => Promise<infer TData> | UseReferencesResult<infer TData>
  ? TData
  : never;
