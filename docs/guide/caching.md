# Caching

The source layer supports persistent caching via `ReferenceCache`.

## In-memory

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

## IndexedDB (via `idb-keyval`)

Optional adapter — requires `idb-keyval` as a peer dependency. The core package stays runtime-agnostic.

```bash
pnpm install idb-keyval
```

```ts
import { ReferenceCache } from '@nimir/references';
import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';

const cache = ReferenceCache.new<User>(
  createIdbKeyvalCache({ database: 'my-app', table: 'references' }),
);
```

## Redis

Generic adapter — bring any Redis client (`ioredis`, `redis`, `@upstash/redis`, etc.).

```ts
import { ReferenceCache } from '@nimir/references';
import { createRedisCache } from '@nimir/references/redis';
import Redis from 'ioredis';

const cache = ReferenceCache.new<User>(
  createRedisCache({ client: new Redis(), prefix: 'my-app:refs:' }),
);
```

## Cache operations

```ts
refs.invalidate('User');          // clear all User cache entries
refs.invalidate('User', ['u1']); // clear specific IDs
refs.restore();                   // hydrate sources from persistent cache
refs.clear();                     // invalidate all sources
```
