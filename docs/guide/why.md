# Why @nimir/references

## The problem

Your API returns IDs. Your UI needs objects. So you write resolution code.

It starts simple:

```ts
const ticket = await fetchTicket('t-1');
const assignee = await fetchUser(ticket.assigneeId);
```

Then it grows. The ticket has watchers. The assignee has a team. The team has a lead. Each of those has nested references too.

```ts
const ticket = await fetchTicket('t-1');

const assignee = ticket.assigneeId
  ? await fetchUser(ticket.assigneeId)
  : null;

const watchers = await Promise.all(
  (ticket.watcherIds ?? []).map(id =>
    id ? fetchUser(id) : null
  ),
);

const team = assignee?.teamId
  ? await fetchTeam(assignee.teamId)
  : null;

const lead = team?.leadUserId
  ? await fetchUser(team.leadUserId)
  : null;

const roles = assignee
  ? await Promise.all(
      (assignee.roleIds ?? []).map(id =>
        id ? fetchRole(id) : null
      ),
    )
  : [];
```

This is just two levels deep with three entity types. Real pages have dozens of reference fields across nested objects and arrays. Every field needs a null check. Every array needs a `Promise.all`. Nothing is batched — you're firing individual fetches. There's no caching, no deduplication, and the types are a mess of `| null | undefined`.

You end up with a blob of imperative fetch-then-assign code that's brittle, hard to read, and wasteful with network calls.

## With @nimir/references

Define your sources once:

```ts
import { defineReferences } from '@nimir/references';

const refs = defineReferences(c => ({
  User: c.source<User>({ batch: ids => fetchUsers(ids) }),
  Team: c.source<Team>({ batch: ids => fetchTeams(ids) }),
  Role: c.source<Role>({ batch: ids => fetchRoles(ids) }),
}));
```

Then declare what's a reference:

```ts
const result = await refs.inline(ticket, {
  fields: {
    assigneeId: {
      source: 'User',
      fields: {
        teamId: {
          source: 'Team',
          fields: { leadUserId: 'User' },
        },
        roleIds: 'Role',
      },
    },
    watcherIds: 'User',
  },
});
```

That's it. The library:

- **Batches** all User fetches into a single call (assignee + watchers + lead — one `fetchUsers` call)
- **Deduplicates** inflight requests (if the same user ID appears in watchers and as team lead, it's fetched once)
- **Resolves nulls** predictably (`null` ID → `null` result, no crashes)
- **Infers the output type** — `result.assigneeIdT` is `User | null`, `result.watcherIdTs` is `(User | null)[]`, all the way down

The resolved fields appear next to the original IDs:

```ts
result.assigneeId            // "u-1" (original, untouched)
result.assigneeIdT           // User | null (resolved)
result.assigneeIdT.teamIdT   // Team | null (nested resolution)
result.watcherIdTs            // (User | null)[] (array resolution)
```

## What about...

### GraphQL

GraphQL solves this at the API layer — your server returns nested objects directly. If you control the API and can use GraphQL, you probably should.

`@nimir/references` is for when you **can't** — REST APIs, legacy backends, third-party services, or mixed data sources where the client receives flat IDs.

### normalizr

normalizr normalizes nested API responses into flat tables. It solves the opposite direction: server gives you nested data, you flatten it for a Redux store.

`@nimir/references` goes the other way: server gives you flat IDs, you resolve them into nested objects. They're complementary, not competing.

### DataLoader

DataLoader batches and deduplicates — and so does `@nimir/references` under the hood. The difference is scope: DataLoader is a primitive for batching individual `load(id)` calls. You still write the resolution logic yourself.

`@nimir/references` is the resolution logic. You declare the shape, it handles the traversal, batching, caching, and type inference. Think of it as DataLoader + a declarative resolution engine.
