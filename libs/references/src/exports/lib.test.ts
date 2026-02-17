import { describe, expect, it } from 'vitest';

import { defineReferences } from './lib.ts';

describe('library entry', () => {
  it('loads from index without runtime-specific adapters', async () => {
    const references = defineReferences(c => ({
      User: c.source<{ id: string }>({
        batch: async ids => ids.map(id => ({ id })),
      }),
    }));

    const result = await references.inline({ userId: 'u1' }, { fields: { userId: 'User' } });
    expect(result).toEqual({ userId: 'u1', userIdT: { id: 'u1' } });
  });
});
