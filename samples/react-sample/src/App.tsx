import { useMemo, useState } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { Navbar } from './components/Navbar';
import { TicketCards } from './components/TicketCards';
import { references } from './configs/references';
import { ticketService } from './services/ticketService';

export function App() {
  const [seed, setSeed] = useState(1);
  const [version, setVersion] = useState(0);

  const ticket = useMemo(() => ticketService.createTicket(seed), [seed]);

  const { result, status, fetchStatus, error, invalidate } = references.use(ticket, {
    fields: {
      assigneeId: 'users',
      watcherIds: 'users',
      meta: { lastEditedById: 'users' },
    },
  });

  return (
    <div className="min-h-screen">
      <Navbar status={status} fetchStatus={fetchStatus} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6" key={version}>
        <ActionButtons
          onShuffle={() => setSeed(x => x + 1)}
          onReResolve={invalidate}
          onRemount={() => setVersion(v => v + 1)}
        />
        {error ? (
          <div className="alert alert-error mb-4">
            <span className="font-semibold">Error</span>
            <span className="font-mono text-sm">{`${error}`}</span>
          </div>
        ) : null}
        <TicketCards ticket={ticket} result={result} />
        <div className="p-2 text-xs opacity-70">
          <span className="font-semibold">Tip:</span> check the react devtools to see the render flow.
        </div>
      </main>
    </div>
  );
}
