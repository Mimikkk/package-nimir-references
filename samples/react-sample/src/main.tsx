import './styles.css';

import { defineReferences } from '@nimir/references/react';
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface User {
  id: string;
  handle: string;
}

interface Ticket {
  id: string;
  title: string;
  assigneeId: string | null;
  watcherIds: (string | null)[];
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const users = new Map<string, User>([
  ['u1', { id: 'u1', handle: 'megumin' }],
  ['u2', { id: 'u2', handle: 'yunyun' }],
  ['u3', { id: 'u3', handle: 'wiz' }],
]);

const userService = {
  fetchByIds: async (ids: string[]): Promise<User[]> => {
    await sleep(250);

    return ids.flatMap(id => {
      const hit = users.get(id);
      return hit ? [hit] : [];
    });
  },
};

const references = defineReferences(c => ({
  users: c.source({
    fetchByIds: userService.fetchByIds,
    batchSize: 50,
    ttlMs: 15_000,
  }),
}));

function createTicket(seed: number): Ticket {
  const ids = ['u1', 'u2', 'u3', 'missing'];
  const pick = (n: number) => ids[n % ids.length]!;

  return {
    id: `t-${seed}`,
    title: `Explode the resolver (seed=${seed})`,
    assigneeId: pick(seed),
    watcherIds: [pick(seed + 1), null, pick(seed + 2)],
  };
}

function App() {
  const [seed, setSeed] = useState(1);
  const [version, setVersion] = useState(0);

  const ticket = useMemo(() => createTicket(seed), [seed]);

  references.use(ticket, {
    fields: {
      assigneeId: 'users',
      watcherIds: 'users',
    },
  });

  // const { result, status, fetchStatus, error, invalidate } = references.use(ticket, {
  //   fields: {
  //     assigneeId: 'users',
  //     watcherIds: 'users',
  //     meta: { lastEditedById: 'users' },
  //   },
  // });

  const resolved = {};
  const fetchStatus = 'idle';
  const error = undefined;
  const invalidate = () => Promise.resolve();

  return (
    <div className="min-h-screen">
      <div className="navbar bg-base-100/80 backdrop-blur border-b border-base-300">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex flex-col">
              <div className="text-lg font-semibold">@nimir/references React adapter sample</div>
              <div className="text-sm opacity-70">
                Resolves <code className="kbd kbd-sm">assigneeId</code>, <code className="kbd kbd-sm">watcherIds</code>,{' '}
                <code className="kbd kbd-sm">meta.lastEditedById</code> from a mocked{' '}
                <code className="kbd kbd-sm">users</code> source.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="badge badge-outline">
                status: <span className="ml-1 font-mono">{status}</span>
              </div>
              <div className="badge badge-outline">
                fetch: <span className="ml-1 font-mono">{fetchStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-5xl px-4 py-6" key={version}>
        <div className="card bg-base-100 border border-base-300 shadow-sm mb-4">
          <div className="card-body gap-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => setSeed(x => x + 1)}>
                Shuffle refs
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  references.invalidate('users');
                  void invalidate();
                }}
              >
                Invalidate users (all) + re-resolve
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  references.invalidate('users', ['u1']);
                  void invalidate();
                }}
              >
                Invalidate users u1 + re-resolve
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  void references.clear().then(() => invalidate());
                }}
              >
                Clear all stores + re-resolve
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  // Forces a remount to prove we don't depend on component identity.
                  setVersion(v => v + 1);
                }}
              >
                Remount app
              </button>
            </div>

            <div className="text-sm opacity-70">
              Tip: set refs to <code className="kbd kbd-sm">missing</code> and watch it resolve to{' '}
              <code className="kbd kbd-sm">null</code>.
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-error mb-4">
            <span className="font-semibold">Error</span>
            <span className="font-mono text-sm">{String(error)}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between gap-2">
                <h2 className="card-title text-base">Input (IDs)</h2>
                <span className="badge badge-neutral badge-outline font-mono">{ticket.id}</span>
              </div>
              <pre className="mt-2 rounded-box bg-base-200 p-4 text-xs overflow-auto">
                {JSON.stringify(ticket, null, 2)}
              </pre>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between gap-2">
                <h2 className="card-title text-base">Output (resolved)</h2>
                <span className="badge badge-success badge-outline font-mono">{resolved ? 'ready' : 'pending'}</span>
              </div>
              <pre className="mt-2 rounded-box bg-base-200 p-4 text-xs overflow-auto">
                {JSON.stringify(resolved, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
