import type { NegativeReason } from './referenceCache.ts';

export function readHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const direct = (error as Record<string, unknown>).status;
  if (typeof direct === 'number') return direct;

  const response = (error as Record<string, unknown>).response;
  if (typeof response !== 'object' || response === null) return undefined;

  const nested = (response as Record<string, unknown>).status;
  return typeof nested === 'number' ? nested : undefined;
}

export function statusToNegativeReason(status: number): NegativeReason {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status >= 500) return 'internal-server-error';
  return 'missing';
}
