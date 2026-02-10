# @nimir/references

Type-safe nested reference resolver for resource graphs.

## Install

```bash
npm i @nimir/references
```

## Core usage

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
  { branchId: 'b1' },
  {
    fields: {
      branchId: { source: 'Branch', fields: { facultyId: 'Faculty' } },
    },
  },
);
```

## Optional IndexedDB adapter

The core library is runtime-agnostic and does not import IndexedDB by default.

```ts
import { ResourceCache } from '@nimir/references';
import { createIndexDbCache } from '@nimir/references/indexeddb';

const cache = ResourceCache.new(createIndexDbCache({ database: 'my-app', store: 'references' }));
```

Pass this cache into a source:

```ts
c.source<User>({
  fetchByIds: ids => fetchUsers(ids),
  cache,
});
```

## API

- `defineReferences((builder) => ({ ...sources }))`
- `references.inline(data, { fields, transform? })`
- `references.fn(fn, { fields, transform? })`
- `references.invalidate(sourceName, ids?)`
- `references.clear()`
