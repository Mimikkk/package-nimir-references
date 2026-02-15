import { defineReferences } from '@nimir/references/react';
import { ReferenceCache } from '@nimir/references';
import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';
import type { User } from '../services/userService';
import { userService } from '../services/userService';

const usersCache = ReferenceCache.new(createIdbKeyvalCache<User>({ database: 'nimir-sample', table: 'users' }));

export const references = defineReferences(c => ({
  users: c.source({
    fetchByIds: userService.fetchByIds,
    batchSize: 50,
    ttlMs: 15_000,
    cache: usersCache,
  }),
}));
