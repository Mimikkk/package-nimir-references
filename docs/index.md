---
layout: home
hero:
  name: '@nimir/references'
  text: Resolve nested references, type-safely
  tagline: Declare which fields are IDs, get fully resolved objects back. Batched, deduplicated, cached.
  actions:
    - theme: brand
      text: Why this exists
      link: /guide/why
    - theme: alt
      text: Get Started
      link: /guide/getting-started

features:
  - icon: ⚡
    title: Batching & dedup
    details: All fetches for the same source are batched into one call. Duplicate IDs across the tree are fetched once.
  - icon: 🔒
    title: Type inference
    details: Resolved fields are inferred automatically. Single IDs get a T suffix, arrays get Ts. No manual typing needed.
  - icon: 🌳
    title: Nested resolution
    details: Resolve up to 10 levels deep. Chain through assignee to team to lead — one declaration, all resolved.
  - icon: 💾
    title: Pluggable caching
    details: In-memory, IndexedDB, or Redis. TTL, cache warming, and negative caching built in.
  - icon: ⚛️
    title: React hooks
    details: Wrap any data-fetching hook or resolve inline data reactively. Works with TanStack Query and custom hooks.
  - icon: 🛡️
    title: Null-safe
    details: null or undefined IDs resolve to null. Missing entities resolve to null. No crashes.
---

<div class="vp-doc" style="max-width: 688px; margin: 0 auto; padding: 0 1.5rem 3rem;">

## Before

```ts
const ticket = await fetchTicket('t-1');

const assignee = ticket.assigneeId ? await fetchUser(ticket.assigneeId) : null;

const watchers = await Promise.all(ticket.watcherIds.map(id => (id ? fetchUser(id) : null)));
// 3 network calls, no batching, no types, repeat per field...
```

## After

```ts
const refs = defineReferences(c => ({
  User: c.source<User>({ batch: ids => fetchUsers(ids) }),
}));

const result = await refs.inline(ticket, {
  fields: { assigneeId: 'User', watcherIds: 'User' },
});

result.assigneeIdT; // User | null
result.watcherIdTs; // (User | null)[]
// 1 network call, all IDs batched, fully typed
```

<p style="margin-top: 2rem; padding: 1rem 1.25rem; border-radius: 8px; border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); font-size: 0.9rem;">
  <strong>AI / LLM integration</strong> — Machine-readable docs available at <a href="/package-nimir-references/llms.txt"><code>llms.txt</code></a> and ship with the npm package.
</p>

</div>
