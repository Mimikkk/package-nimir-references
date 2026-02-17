import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ResolveOptions, VanillaAPI } from 'src/adapters/frameworks/vanilla';
import { Fn, isNil } from 'src/core/common';
import { FnAwait, SourcesContext, sourcesContext } from 'src/core/defineReferences.ts';
import { ReferenceResolver } from 'src/core/referenceResolver.ts';
import { RefFields, Resolve, Source, SourceRegistry } from 'src/core/types.ts';

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

export class ReactAPI<TSources extends SourceRegistry> extends VanillaAPI<TSources> {
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
    const initialSync = useMemo(() => this.resolver.resolveSync(data, options.fields), [data]);

    const [result, setResult] = useState<TResult | undefined>(
      initialSync.status === 'ok'
        ? isNil(initialSync.result)
          ? undefined
          : (options.transform?.(initialSync.result!) ?? (initialSync.result as TResult))
        : undefined,
    );
    const [status, setStatus] = useState<ResultStatus>(initialSync.status === 'ok' ? 'success' : 'pending');
    const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
    const [error, setError] = useState<unknown | undefined>(undefined);
    const initialRef = useRef(true);
    const versionRef = useRef<number>(0);

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
      if (initialRef.current && initialSync.status === 'ok') {
        initialRef.current = false;
        return;
      }

      initialRef.current = false;
      const sync = this.resolver.resolveSync(data, options.fields);
      if (sync.status === 'ok') {
        setResult(isNil(sync.result) ? undefined : (options.transform?.(sync.result!) ?? (sync.result as TResult)));
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
): ReactAPI<TSources> {
  const stores = new Map(Object.entries(sources(sourcesContext)) as [Extract<keyof TSources, string>, Source][]);
  const resolver = ReferenceResolver.from(stores);

  return ReactAPI.from(stores, resolver);
}
