import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

function runNode(args: string[]): { stdout: string; stderr: string } {
  const stdout = execFileSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return { stdout, stderr: '' };
}

function runNodeWithOutput(args: string[]): { stdout: string; stderr: string } {
  try {
    return runNode(args);
  } catch (error) {
    // Surface child process output in test failure.
    const e = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout ? e.stdout.toString('utf8') : '';
    const stderr = e.stderr ? e.stderr.toString('utf8') : '';
    throw new Error([e.message ?? 'node subprocess failed', '--- stdout ---', stdout, '--- stderr ---', stderr].join('\n'));
  }
}

describe('environment smoke', () => {
  it('imports package + subpaths in Node ESM', () => {
    const code = `
      import { defineReferences, ResourceCache } from '@nimir/references';
      import { createMemoryCache } from '@nimir/references/in-memory';

      if (typeof defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = ResourceCache.new(createMemoryCache());
      if (!cache) throw new Error('cache missing');

      // optional adapter should be importable and usable when IndexedDB exists
      import 'fake-indexeddb/auto';
      import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';
      ResourceCache.new(createIdbKeyvalCache({ database: 'db', table: 'tbl' }));

      console.log('ok');
    `;

    const { stdout } = runNodeWithOutput(['--input-type=module', '-e', code]);
    expect(stdout.trim()).toBe('ok');
  });

  it('imports package + subpaths in Node CJS', () => {
    const code = `
      const lib = require('@nimir/references');
      const mem = require('@nimir/references/in-memory');

      if (typeof lib.defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = lib.ResourceCache.new(mem.createMemoryCache());
      if (!cache) throw new Error('cache missing');

      require('fake-indexeddb/auto');
      const idb = require('@nimir/references/idb-keyval');
      lib.ResourceCache.new(idb.createIdbKeyvalCache({ database: 'db', table: 'tbl' }));

      console.log('ok');
    `;

    const { stdout } = runNodeWithOutput(['-e', code]);
    expect(stdout.trim()).toBe('ok');
  });
});

