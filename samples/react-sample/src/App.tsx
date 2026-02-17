import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { Navbar } from './components/Navbar';
import { TicketCards } from './components/TicketCards';
import { references } from './configs/references';
import { ticketService } from './services/ticketService';

const WarmupKey = 'should-warmup';
function useWarmupControl() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(WarmupKey) === '1');

  const set = useCallback((v: boolean) => {
    setEnabled(v);
    localStorage.setItem(WarmupKey, v ? '1' : '0');
  }, []);

  return [enabled, set] as const;
}

export function App() {
  const [seed, setSeed] = useState(1);
  const [version, setVersion] = useState(0);
  const [shouldWarmup, setShouldWarmup] = useWarmupControl();

  useEffect(() => {
    if (shouldWarmup) references.warmup();
  }, [shouldWarmup]);

  const ticket = useMemo(() => ticketService.createTicket(seed), [seed]);

  const { result, status, fetchStatus, error, invalidate } = references.use(ticket, {
    fields: {
      assigneeId: 'users',
      watcherIds: 'users',
      meta: { lastEditedById: 'users' },
    },
  });

  const handleShuffle = useCallback(() => setSeed(x => x + 1), []);
  const handleReResolve = useCallback(() => invalidate(), [invalidate]);
  const handleRemount = useCallback(() => setVersion(v => v + 1), []);

  return (
    <div className="min-h-screen">
      <Navbar status={status} fetchStatus={fetchStatus} warmupEnabled={shouldWarmup} onWarmupToggle={setShouldWarmup} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6" key={version}>
        <ActionButtons onShuffle={handleShuffle} onReResolve={handleReResolve} onRemount={handleRemount} />
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
