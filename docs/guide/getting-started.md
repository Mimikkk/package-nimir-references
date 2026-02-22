# Getting Started

## Install

::: code-group

```bash [pnpm]
pnpm install @nimir/references
```

```bash [npm]
npm install @nimir/references
```

```bash [yarn]
yarn add @nimir/references
```

```bash [deno]
deno install npm:@nimir/references
```

```bash [bun]
bun install npm:@nimir/references
```

:::

## Quick start

Define your sources — these describe how to fetch each resource type:

```ts
import { defineReferences } from '@nimir/references';

type User = { id: string; name: string };
type Permission = { id: string; userId: string };

const references = defineReferences(c => ({
  User: c.source<User>({
    batch: async ids => fetchFaculties(ids),
  }),
  Permission: c.source<Permission>({
    batch: async ids => fetchPermissiones(ids),
  }),
}));
```

Resolve references in any payload by declaring which fields are reference IDs:

```ts
const result = await references.inline(
  { permissionId: 'p1' as string | null },
  {
    fields: {
      permissionId: { source: 'Permission', fields: { userId: 'User' } },
    },
  },
);

// result.permissionIdT  → Permission | null
// result.permissionIdT.userIdT → User | null
```

The original `permissionId` field stays as-is. The resolved entity is added at `permissionIdT` — fully typed, null-safe.

## Features

- `defineReferences(builder)` — create a typed reference resolver with named sources.
- `refs.inline(data, config)` — resolve references in a payload, return a cloned result.
- `refs.fn(fn, config)` — wrap an async function; auto-resolve references in its return value.
- `refs.invalidate(source, ids?)` — clear cache entries for a source.
- `refs.restore()` — hydrate sources from persistent cache.
- `refs.clear()` — invalidate all sources.
- Batch and list source modes with inflight deduplication.
- Pluggable caching: in-memory, IndexedDB (`idb-keyval`), Redis.
- React integration via `refs.hook` and `refs.use`.
- Nested resolution up to 10 levels deep.
- Null-safe: missing IDs resolve to `null`.
