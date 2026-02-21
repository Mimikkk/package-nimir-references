import { ReferenceCache } from '@nimir/references';
import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';
import { defineReferences } from '@nimir/references/react';
import type { User } from '../services/userService';
import { userService } from '../services/userService';

const usersCache = ReferenceCache.new<User>(createIdbKeyvalCache({ database: 'nimir-sample', table: 'users' }));

export const references = defineReferences(c => ({
  users: c.source({
    batch: userService.fetchByIds,
    batchSize: 50,
    ttlMs: 15_000,
    cache: usersCache,
  }),
}));
