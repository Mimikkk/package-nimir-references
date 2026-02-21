# @nimir/references

Type-safe nested reference resolver for resource graphs.

Define _sources_ (how to fetch resources by ID), then resolve arbitrary payloads by declaring which fields are references.

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
    batch: async ids => fetchFaculties(ids),
  }),
  Branch: c.source<Branch>({
    batch: async ids => fetchBranches(ids),
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

// result.branchIdT  → Branch | null
// result.branchIdT.facultyIdT → Faculty | null
```

## How resolution works

### Fields config

Resolution is driven by a `fields` object that mirrors the shape of your data:

- **Direct ref**: `{ userId: 'User' }`
- **Direct ref array**: `{ userIds: 'User' }` (where `userIds` is `Array<string | null | undefined>`)
- **Nested ref**: `{ branchId: { source: 'Branch', fields: { facultyId: 'Faculty' } } }`
- **Structural nesting** (into objects/arrays without creating a reference):
  - `{ profile: { avatarFileId: 'File' } }`
  - `{ items: { productId: 'Product' } }` for `items: Array<{ productId: ... }>`

### Output shape (`T` / `Ts`)

For a field `x`:

- If `x` is a single ref ID (`string | null | undefined`), the resolved value is added at **`xT`**.
- If `x` is an array of ref IDs (`Array<string | null | undefined>`), the resolved values are added at **`xTs`**.

The original ID fields stay as-is; the library returns a cloned object (no mutation).

### Null / missing semantics

- If the ID is `null`/`undefined`, the corresponding `xT` / `xTs[i]` is `null`.
- If the ID is present but not returned by the source, it resolves to `null`.

## Define sources

`defineReferences` takes a builder callback. Each entry becomes a named source usable in `fields`.

Sources can be configured in two modes:

### `batch` — fetch by IDs

Fetches only requested IDs. Supports batching, inflight deduplication, and negative caching.

```ts
import { defineReferences } from '@nimir/references';

type User = { id: string; email: string };

const references = defineReferences(c => ({
  User: c.source<User>({
    batch: async ids => fetchUsers(ids),
    // batchSize: 200,       (max IDs per batch call, default 200)
    // ttlMs: 60_000,        (cache TTL in ms, default 4 hours)
    // keyBy: u => u.id,     (ID extractor, default item.id)
    // cache: ReferenceCache.new(createMemoryCache()),
  }),
}));
```

### `list` — fetch all

Fetches a full collection and resolves from it. Refreshes on TTL expiry.

```ts
const references = defineReferences(c => ({
  Role: c.source<Role>({
    list: async () => fetchAllRoles(),
    // ttlMs: 60_000,
    // keyBy: r => r.id,
    // cache: ReferenceCache.new(createMemoryCache()),
  }),
}));
```

## Caching

The source layer supports persistent caching via `ReferenceCache`.

```ts
import { ReferenceCache } from '@nimir/references';
import { createMemoryCache } from '@nimir/references/in-memory';

type User = { id: string; email: string };

const cache = ReferenceCache.new<User>(createMemoryCache());

const references = defineReferences(c => ({
  User: c.source<User>({
    batch: ids => fetchUsers(ids),
    cache,
    ttlMs: 5 * 60_000,
  }),
}));
```

### IndexedDB (via `idb-keyval`)

Optional adapter — the core package stays runtime-agnostic.

```ts
import { ReferenceCache } from '@nimir/references';
import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';

const cache = ReferenceCache.new<User>(
  createIdbKeyvalCache({ database: 'my-app', table: 'references' }),
);
```

### Redis

Generic adapter — bring any Redis client (`ioredis`, `redis`, `@upstash/redis`, etc.).

```ts
import { ReferenceCache } from '@nimir/references';
import { createRedisCache } from '@nimir/references/redis';
import Redis from 'ioredis';

const cache = ReferenceCache.new<User>(
  createRedisCache({ client: new Redis(), prefix: 'my-app:refs:' }),
);
```

## API

- `defineReferences((builder) => ({ ...sources }))` — create a `Refs` instance.
- `refs.inline(data, { fields, transform? })` — resolve references in `data`, return a cloned result.
- `refs.fn(fn, { fields, transform? })` — wrap an async function; resolves references in its return value.
- `refs.invalidate(sourceName, ids?)` — clear in-memory + persistent cache entries for one source.
- `refs.restore()` — eagerly hydrate all sources from persistent cache.
- `refs.clear()` — invalidate all sources.

### React

```ts
import { defineReferences } from '@nimir/references/react';

const refs = defineReferences(c => ({ ... }));

// Wrap a hook — returns { result, status, fetchStatus, error, invalidate }
const useTicket = refs.hook(useGetTicket, { fields: { assigneeId: 'User' } });

// Or resolve inline data
const resolved = refs.use(data, { fields: { assigneeId: 'User' } });
```

## Notes

- **Depth limit**: resolution is bounded at 10 levels to prevent infinite loops on circular configs.
- **Unknown sources**: referencing a source name that doesn't exist at runtime is silently skipped.
