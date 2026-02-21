# React API

The React entry point extends the base Node API with reactive hooks.

```ts
import { defineReferences } from '@nimir/references/react';
```

All Node API methods (`inline`, `fn`, `invalidate`, `restore`, `clear`) are available, plus the following:

## `refs.hook`

```ts
const useTicket = refs.hook(useGetTicket, {
  fields: { assigneeId: 'User' },
});

function TicketCard({ id }: { id: string }) {
  const { result, status, fetchStatus, error, invalidate } = useTicket(id);
  // result.assigneeIdT → User | null
}
```

Wraps a data-fetching hook (e.g. from TanStack Query or a custom hook). The wrapped hook returns:

| Property      | Type            | Description                                          |
| ------------- | --------------- | ---------------------------------------------------- |
| `result`      | `Resolved<T>`   | The resolved data with reference fields populated    |
| `status`      | `string`        | Query status (`'pending'` / `'success'` / `'error'`) |
| `fetchStatus` | `string`        | Fetch status (`'idle'` / `'fetching'`)               |
| `error`       | `Error \| null` | Query error, if any                                  |
| `invalidate`  | `() => void`    | Invalidate the underlying query                      |

The source hook must return an object with `{ data, status, fetchStatus, error, invalidate }`.

## `refs.use`

```ts
function ResolvedView({ data }: { data: Ticket }) {
  const resolved = refs.use(data, {
    fields: { assigneeId: 'User' },
  });
  // resolved.assigneeIdT → User | null
}
```

Resolve inline data reactively. Re-resolves when the input `data` changes. Returns `undefined` while resolution is in progress.
