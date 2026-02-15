import { memo } from 'react';
import type { Ticket } from '../services/ticketService';

interface TicketCardsProps {
  ticket: Ticket;
  result: unknown;
}

export const TicketCards = memo<TicketCardsProps>(function TicketCards({ ticket, result }) {
  return (
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
            <span className="badge badge-success badge-outline font-mono">{result ? 'ready' : 'pending'}</span>
          </div>
          <pre className="mt-2 rounded-box bg-base-200 p-4 text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
});
