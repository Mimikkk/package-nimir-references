import type { Nil } from '../types/common';

export interface Ticket {
  id: string;
  title: string;
  assigneeId: Nil<string>;
  watcherIds: Nil<Nil<string>[]>;
}

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

export const ticketService = {
  createTicket,
};
