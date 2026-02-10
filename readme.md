# @nimir/references

Type-safe nested reference resolver for resource graphs.

You define _sources_ (how to fetch resources by ID), then resolve an arbitrary payload by declaring which fields are references.

## Install

```bash
npm i @nimir/references
```

## Quick start

```ts
import { defineReferences } from '@nimir/references';

type Faculty = { id: string; name: string };
type Branch = { id: string; facultyId: string };

const references = defineReferences(c => ({
  Faculty: c.source<Faculty>({
    fetchByIds: async ids => fetchFaculties(ids),
  }),
  Branch: c.source<Branch>({
    fetchByIds: async ids => fetchBranches(ids),
  }),
}));

const result = await references.inline(
  { branchId: 'b1' as string | null },
  {
    fields: {
      branchId: { source: 'Branch', fields: { facultyId: 'Faculty' } },
    },
  },
);

// result has added fields:
// - branchIdRef: Branch | null | undefined
// - and nested: branchIdT.facultyIdRef: Faculty | null | undefined
```

## How resolution works

### Fields config

Resolution is driven by a `fields` object that mirrors the shape of your data:

- **Direct ref**: `{ userId: 'User' }`
- **Direct ref array**: `{ userIds: 'User' }` (where `userIds` is `Array<string | null | undefined>`)
- **Nested ref**: `{ branchId: { source: 'Branch', fields: { facultyId: 'Faculty' } } }`
- **Structural nesting**: You can go into objects/arrays-of-objects without creating a reference:
  - `{ profile: { avatarFileId: 'File' } }`
  - `{ items: { productId: 'Product' } }` for `items: Array<{ productId: ... }>`

### Output shape (`T` / `Ts`)

For a field `x`:

- If `x` is a single ref ID (`string | null | undefined`), the resolved value is added at **`xT`**.
- If `x` is an array of ref IDs (`Array<string | null | undefined>`), the resolved value is added at **`xTs`**.

The original ID fields stay as-is; the library returns a cloned object (it does not mutate your input).

### Null / missing semantics

- If the ID is `null`/`undefined`, the corresponding `xT` / `xTs[i]` is `null` (and may remain `undefined` for completely absent properties).
- If the ID is present but not returned by the source, it resolves to `null`.

## Define sources

`defineReferences` takes a builder callback. Each entry becomes a named source that can be used in your `fields`.

```ts
import { defineReferences } from '@nimir/references';

type User = { id: string; email: string };

const references = defineReferences(c => ({
  User: c.source<User>({
    fetchByIds: async ids => fetchUsers(ids),
    // optional:
    // ttlMs: 60_000,
    // batchSize: 200,
    // keyBy: u => u.id,
    // cache: ResourceCache.new(createMemoryCache()),
  }),
}));
```

Sources can be configured in two modes:

- **`fetchByIds`**: fetch just what you need (supports batching + negative caching).
- **`fetchAll`**: fetch a whole collection and resolve from it (with TTL refresh).

## Caching

The store layer can use a persistent cache via `ResourceCache` (exported alias of `ReferenceCache`).

```ts
import { ResourceCache } from '@nimir/references';
import { createMemoryCache } from '@nimir/references/in-memory';

type User = { id: string; email: string };

const cache = ResourceCache.new<User>(createMemoryCache());

const references = defineReferences(c => ({
  User: c.source<User>({
    fetchByIds: ids => fetchUsers(ids),
    cache,
    ttlMs: 5 * 60_000,
  }),
}));
```

### IndexedDB (via `idb-keyval`)

This is an optional adapter (core stays runtime-agnostic).

```ts
import { ResourceCache } from '@nimir/references';
import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';

type User = { id: string; email: string };

const cache = ResourceCache.new<User>(createIdbKeyvalCache({ database: 'my-app', table: 'references' }));
```

## API

- `defineReferences((builder) => ({ ...sources }))`
- `references.inline(data, { fields, transform? })`
  - Resolves references in `data` and returns the resolved clone.
  - Optional `transform` runs after resolution (use it to project the result).
- `references.fn(fn, { fields, transform? })`
  - Wraps an async function; resolves references in its returned value.
- `references.invalidate(sourceName, ids?)`
  - Clears in-memory + persistent cache entries for one source (optionally only specific IDs).
- `references.clear()`
  - Clears all sources.

## Notes / gotchas

- **Depth limit**: resolution is bounded (to avoid infinite loops on circular configs).
- **Unknown sources**: if you reference a source name that does not exist at runtime, it is skipped (no throw).
