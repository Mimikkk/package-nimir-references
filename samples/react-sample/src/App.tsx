import { useEffect, useMemo, useState } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { Navbar } from './components/Navbar';
import { TicketCards } from './components/TicketCards';
import { references } from './configs/references';
import { ticketService } from './services/ticketService';

const WARMUP_KEY = 'nimir-sample-warmup';

function useWarmupToggle(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(WARMUP_KEY) === '1';
    } catch {
      return false;
    }
  });

  const set = (v: boolean) => {
    setEnabled(v);
    try {
      localStorage.setItem(WARMUP_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  return [enabled, set];
}

export function App() {
  const [seed, setSeed] = useState(1);
  const [version, setVersion] = useState(0);
  const [warmupEnabled, setWarmupEnabled] = useWarmupToggle();

  useEffect(() => {
    if (warmupEnabled) references.warmup();
  }, [warmupEnabled]);

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
      <Navbar
        status={status}
        fetchStatus={fetchStatus}
        warmupEnabled={warmupEnabled}
        onWarmupToggle={setWarmupEnabled}
      />
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
