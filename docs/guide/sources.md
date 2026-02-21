# Sources

`defineReferences` takes a builder callback. Each entry becomes a named source usable in `fields`.

Sources can be configured in two modes:

## `batch` — fetch by IDs

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

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `batch` | `(ids: string[]) => Promise<T[]>` | — | Fetch function, receives batched IDs |
| `batchSize` | `number` | `200` | Max IDs per batch call |
| `ttlMs` | `number` | `14_400_000` (4h) | Cache TTL in milliseconds |
| `keyBy` | `(item: T) => string` | `item => item.id` | ID extractor |
| `cache` | `ReferenceCache<T>` | in-memory | Persistent cache adapter |

## `list` — fetch all

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

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `list` | `() => Promise<T[]>` | — | Fetch function, returns full collection |
| `ttlMs` | `number` | `14_400_000` (4h) | Cache TTL in milliseconds |
| `keyBy` | `(item: T) => string` | `item => item.id` | ID extractor |
| `cache` | `ReferenceCache<T>` | in-memory | Persistent cache adapter |
