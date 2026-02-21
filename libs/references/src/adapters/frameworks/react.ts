import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { Fn, FnAwait } from '../../core/common.ts';
import { createReferenceContext, type ReferenceContext, type SourcesContext } from '../../core/defineReferences.ts';
import type { RefFields, Resolve, SourceRegistry } from '../../core/types.ts';
import { Refs as VanillaRefs, type ResolveOptions } from './vanilla.ts';

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

/**
 * The result of a useReferences hook.
 * @param TResult - The type of the result.
 */
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

/**
 * The hook function for useReferences.
 * @param THook - The hook function to use.
 * @param TSources - The sources to use.
 * @param TFields - The fields to use.
 * @param TResult - The type of the result.
 */
interface UseReferences<
  THook extends Fn,
  TSources extends SourceRegistry,
  TFields extends RefFields<FnAwait<THook>, TSources>,
  TResult = Resolve<FnAwait<THook>, TSources, TFields>,
> {
  (...params: Parameters<THook>): UseReferencesResult<TResult>;
}

/**
 * References resolver for React.
 *
 * @param TSources - The sources to use.
 */
export class Refs<TSources extends SourceRegistry> extends VanillaRefs<TSources> {
  /**
   * Creates a new Refs instance from a context.
   * @param context - The context to use.
   * @returns The new Refs instance.
   */
  static fromContext<TSources extends SourceRegistry>({
    stores,
    resolver,
  }: ReferenceContext<TSources>): Refs<TSources> {
    return new this(stores, resolver);
  }

  hook<
    TUse extends Fn,
    TFields extends RefFields<FnAwait<TUse>, TSources>,
    TResult = Resolve<FnAwait<TUse>, TSources, TFields>,
  >(
    use: TUse,
    options: ResolveOptions<FnAwait<TUse>, TFields, TSources, TResult>,
  ): UseReferences<TUse, TSources, TFields, TResult | undefined> {
    const self = this;

    return function useReferences(...params) {
      return self.use(use(...params), options);
    };
  }

  use<TData, TFields extends RefFields<TData, TSources>, TResult = Resolve<TData, TSources, TFields>>(
    data: TData,
    options: ResolveOptions<TData, TFields, TSources, TResult>,
  ): UseReferencesResult<TResult | undefined> {
    const memory = useMemo(() => this.inlineSync(data, options), [data]);

    const [result, setResult] = useState<TResult | undefined>(memory.result ?? undefined);
    const [status, setStatus] = useState<ResultStatus>(memory.status === 'ok' ? 'success' : 'pending');
    const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
    const [error, setError] = useState<unknown | undefined>(undefined);
    const versionRef = useRef(0);

    const resolve = useEffectEvent(async () => {
      const version = ++versionRef.current;

      try {
        setFetchStatus('fetching');
        const result = await this.inline(data, options);

        if (versionRef.current === version) {
          setResult(result ?? undefined);
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
        setResult(memory.result ?? undefined);
        setStatus('success');
        return;
      }

      resolve();
    }, [memory]);

    return { result, error, status, fetchStatus, invalidate };
  }
}

export function defineReferences<TSources extends SourceRegistry>(
  sources: (context: SourcesContext) => TSources,
): Refs<TSources> {
  return Refs.fromContext(createReferenceContext(sources));
}

export type SourcesOf<TRefs extends Refs<any>> =
  TRefs extends Refs<infer TSources extends SourceRegistry> ? TSources : never;

export type ResolveOf<TType extends Fn> = TType extends (
  ...params: any[]
) => Promise<infer TData> | UseReferencesResult<infer TData>
  ? TData
  : never;
