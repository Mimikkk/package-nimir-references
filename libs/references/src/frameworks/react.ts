import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { API, ResolveOptions } from 'src/core/API.ts';
import { Fn, isNil, Nil } from 'src/core/common';
import { FnAwait, SourcesContext, sourcesContext } from 'src/core/defineReferences.ts';
import { ReferenceResolver } from 'src/core/referenceResolver.ts';
import { RefFields, Resolve, Source, SourceRegistry } from 'src/core/types.ts';

type ResultStatus = 'pending' | 'error' | 'success';
type FetchStatus = 'fetching' | 'idle';

interface UseReferencesResult<TResult> {
  error: unknown | undefined;
  result: TResult | undefined;
  status: ResultStatus;
  fetchStatus: FetchStatus;
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

export class ReactAPI<TSources extends SourceRegistry> extends API<TSources> {
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

    return function useResolve(...params: Parameters<THook>): UseReferencesResult<TResult> {
      return self.use(hook(...params), options);
    };
  }

  use<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: Nil<TData>,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): UseReferencesResult<TResult> {
    const [result, setResult] = useState<TResult | undefined>(undefined);
    const [status, setStatus] = useState<ResultStatus>('pending');
    const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
    const [error, setError] = useState<unknown | undefined>(undefined);
    const inflightRef = useRef<PromiseWithResolvers<void> | null>(null);

    const resolve = useEffectEvent(async () => {
      if (isNil(data)) return;
      if (inflightRef.current) {
        inflightRef.current.reject(new Error('Cancelled by new resolve call'));
        inflightRef.current = null;
      }

      const resolvers = Promise.withResolvers<void>();
      inflightRef.current = resolvers;

      try {
        setFetchStatus('fetching');
        const res = (await this.inline(data, options)) as TResult;
        if (inflightRef.current === resolvers) {
          setResult(res);
          setError(undefined);
          setStatus('success');
          resolvers.resolve();
        }
      } catch (error) {
        if (inflightRef.current === resolvers) {
          setResult(undefined);
          setError(error);
          setStatus('error');
          resolvers.reject(error);
        }
      } finally {
        if (inflightRef.current === resolvers) {
          setFetchStatus('idle');
          inflightRef.current = null;
        }
      }
    });

    const invalidate = useCallback(() => resolve(), []);

    useEffect(() => {
      resolve();

      return () => {
        if (!inflightRef.current) return;
        inflightRef.current.reject(new Error('useReferences unmounted'));
        inflightRef.current = null;
      };
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
): ReactAPI<TSources> {
  const stores = new Map(Object.entries(sources(sourcesContext)) as [Extract<keyof TSources, string>, Source][]);
  const resolver = ReferenceResolver.from(stores);

  return ReactAPI.from(stores, resolver);
}
