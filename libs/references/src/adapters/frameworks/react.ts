import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Fn, isNil } from '../../core/common.ts';
import { createReferenceContext, FnAwait, SourcesContext } from '../../core/defineReferences.ts';
import { ReferenceResolver } from '../../core/referenceResolver.ts';
import { RefFields, Resolve, Source, SourceRegistry } from '../../core/types.ts';
import { ResolveOptions, Refs as VanillaRefs } from './vanilla.ts';

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

interface UseResolve<
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
    stores: ReadonlyMap<string, Source>,
    resolver: ReferenceResolver<TSources>,
  ) {
    return new this(stores, resolver);
  }

  hook<
    THook extends Fn,
    TFields extends RefFields<FnAwait<THook>, TSources>,
    TResult = Resolve<FnAwait<THook>, TSources, TFields>,
  >(
    hook: THook,
    options: ResolveOptions<FnAwait<THook>, TFields, TSources, TResult>,
  ): UseResolve<THook, TSources, TFields, TResult> {
    const self = this;

    return function useReferences(...params: Parameters<THook>): UseReferencesResult<TResult> {
      return self.use(hook(...params), options);
    };
  }

  use<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): UseReferencesResult<TResult> {
    const sync = useMemo(() => this.resolver.resolveFromMemory(data, options.fields), [data]);

    const [result, setResult] = useState<TResult | undefined>(() =>
      sync.status === 'ok' ? toResult(sync.result, options.transform) : undefined,
    );
    const [status, setStatus] = useState<ResultStatus>(sync.status === 'ok' ? 'success' : 'pending');
    const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
    const [error, setError] = useState<unknown | undefined>(undefined);
    const isFirstRenderRef = useRef(false);
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
      if (isFirstRenderRef.current === false && sync.status === 'ok') {
        setResult(toResult(sync.result, options.transform));
        isFirstRenderRef.current = true;
        return;
      }
      isFirstRenderRef.current = true;

      if (sync.status === 'ok') {
        setResult(toResult(sync.result, options.transform));
        setStatus('success');
        return;
      }

      if (isNil(data)) return;
      resolve();
    }, [data]);

    return {
      result,
      error,
      status,
      fetchStatus,
      invalidate,
    };
  }
}

export function defineReferences<TSources extends SourceRegistry>(
  sources: (context: SourcesContext) => TSources,
): Refs<TSources> {
  const { stores, resolver } = createReferenceContext(sources);
  return Refs.from(stores, resolver);
}
