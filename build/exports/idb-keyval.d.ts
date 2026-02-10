/**
 * @packageDocumentation
 *
 * IndexedDB cache adapter for `ResourceCache`, built on `idb-keyval`.
 *
 * This is an optional runtime adapter. The core `@nimir/references` package does not
 * import IndexedDB unless you import this subpath.
 */
export { createIdbKeyvalCache, type IdbKeyvalCacheOptions } from '../adapters/idb-keyval.ts';
