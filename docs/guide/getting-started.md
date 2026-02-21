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
```

Resolve references in any payload by declaring which fields are reference IDs:

```ts
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

The original `branchId` field stays as-is. The resolved entity is added at `branchIdT` — fully typed, null-safe.

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
