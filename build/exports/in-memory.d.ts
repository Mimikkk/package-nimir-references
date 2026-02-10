/**
 * @packageDocumentation
 *
 * In-memory cache adapter for `ResourceCache`.
 *
 * This is a simple process-local Map-backed cache.
 * It is useful for tests, SSR, and non-persistent caching.
 */
export { createMemoryCache, type MemoryCacheOptions } from '../adapters/in-memory.ts';
