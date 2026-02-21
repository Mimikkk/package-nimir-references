# Node API

## `defineReferences`

```ts
import { defineReferences } from '@nimir/references';

const refs = defineReferences(c => ({
  User: c.source<User>({ batch: async ids => fetchUsers(ids) }),
  Team: c.source<Team>({ list: async () => fetchAllTeams() }),
}));
```

Creates a `Refs` instance with typed sources.

## `refs.inline`

```ts
const result = await refs.inline(data, { fields, transform? });
```

Resolve references in `data`, return a cloned result. The `fields` config declares which properties are reference IDs and what source to resolve them from.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `data` | `T` | The payload to resolve references in |
| `fields` | `FieldsConfig` | Declares which fields are reference IDs |
| `transform` | `(resolved: R) => U` | Optional transform applied to the resolved result |

## `refs.fn`

```ts
const getTicket = refs.fn(fetchTicket, { fields, transform? });
const result = await getTicket('ticket-1');
```

Wrap an async function — auto-resolve references in its return value. The wrapped function has the same signature as the original.

## `refs.invalidate`

```ts
await refs.invalidate('User');          // all entries
await refs.invalidate('User', ['u1']); // specific IDs
```

Clear in-memory + persistent cache entries for one source.

## `refs.restore`

```ts
await refs.restore();
```

Eagerly hydrate all sources from persistent cache. Call on app startup to warm caches.

## `refs.clear`

```ts
await refs.clear();
```

Invalidate all sources — clears both in-memory and persistent caches.
