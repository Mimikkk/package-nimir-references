import { defineReferences } from '@nimir/references/react';
import { userService } from '../services/userService';

export const references = defineReferences(c => ({
  users: c.source({
    fetchByIds: userService.fetchByIds,
    batchSize: 50,
    ttlMs: 15_000,
  }),
}));
