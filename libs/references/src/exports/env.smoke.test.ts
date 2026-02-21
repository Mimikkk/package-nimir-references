import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..', '..'); // libs/references

function run(cmd: string, args: string[], cwd: string): { stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '' };
  } catch (error) {
    const e = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout ? e.stdout.toString('utf8') : '';
    const stderr = e.stderr ? e.stderr.toString('utf8') : '';
    throw new Error([e.message ?? 'subprocess failed', '--- stdout ---', stdout, '--- stderr ---', stderr].join('\n'));
  }
}

function hasRuntime(cmd: string): boolean {
  try {
    execFileSync(cmd, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('environment smoke (served package)', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'nimir-refs-smoke-'));
  const tarball = path.join(pkgRoot, 'nimir-references-0.0.0.tgz');

  beforeAll(() => run('pnpm', ['pack'], pkgRoot));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('imports package + subpaths in Node ESM', () => {
    const pkg = {
      type: 'module' as const,
      dependencies: {
        '@nimir/references': `file:${tarball.replace(/\\/g, '/')}`,
        'fake-indexeddb': '^6.2.5',
        'idb-keyval': '^6.2.2',
      },
    };
    writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg, null, 2));
    run('pnpm', ['install', '--ignore-scripts'], tmp);

    const code = `
      import { defineReferences, ReferenceCache } from '@nimir/references';
      import { createMemoryCache } from '@nimir/references/in-memory';

      if (typeof defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = ReferenceCache.new(createMemoryCache());
      if (!cache) throw new Error('cache missing');

      import 'fake-indexeddb/auto';
      import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';
      ReferenceCache.new(createIdbKeyvalCache({ database: 'db', table: 'tbl' }));

      console.log('ok');
    `;

    const { stdout } = run(process.execPath, ['--input-type=module', '-e', code], tmp);
    expect(stdout.trim()).toBe('ok');
  });

  it('imports package + subpaths in Node CJS', () => {
    const pkg = {
      type: 'commonjs' as const,
      dependencies: {
        '@nimir/references': `file:${tarball.replace(/\\/g, '/')}`,
        'fake-indexeddb': '^6.2.5',
        'idb-keyval': '^6.2.2',
      },
    };
    writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg, null, 2));
    run('pnpm', ['install', '--ignore-scripts'], tmp);

    const code = `
      const lib = require('@nimir/references');
      const mem = require('@nimir/references/in-memory');

      if (typeof lib.defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = lib.ReferenceCache.new(mem.createMemoryCache());
      if (!cache) throw new Error('cache missing');

      require('fake-indexeddb/auto');
      const idb = require('@nimir/references/idb-keyval');
      lib.ReferenceCache.new(idb.createIdbKeyvalCache({ database: 'db', table: 'tbl' }));

      console.log('ok');
    `;

    const { stdout } = run(process.execPath, ['-e', code], tmp);
    expect(stdout.trim()).toBe('ok');
  });

  it.skipIf(!hasRuntime('deno'))('imports package + subpaths in Deno', () => {
    const denoTmp = path.join(tmp, 'deno');
    const { mkdirSync } = require('node:fs') as typeof import('node:fs');
    mkdirSync(denoTmp, { recursive: true });

    const pkg = {
      type: 'module' as const,
      dependencies: {
        '@nimir/references': `file:${tarball.replace(/\\/g, '/')}`,
      },
    };
    writeFileSync(path.join(denoTmp, 'package.json'), JSON.stringify(pkg, null, 2));
    run('pnpm', ['install', '--ignore-scripts'], denoTmp);

    const code = `
      import { defineReferences, ReferenceCache } from '@nimir/references';
      import { createMemoryCache } from '@nimir/references/in-memory';

      if (typeof defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = ReferenceCache.new(createMemoryCache());
      if (!cache) throw new Error('cache missing');

      console.log('ok');
    `;

    writeFileSync(path.join(denoTmp, 'main.ts'), code);
    const { stdout } = run('deno', ['run', '--allow-read', '--allow-env', '--node-modules-dir=manual', 'main.ts'], denoTmp);
    expect(stdout.trim()).toBe('ok');
  });

  it.skipIf(!hasRuntime('bun'))('imports package + subpaths in Bun', () => {
    const bunTmp = path.join(tmp, 'bun');
    const { mkdirSync } = require('node:fs') as typeof import('node:fs');
    mkdirSync(bunTmp, { recursive: true });

    const pkg = {
      type: 'module' as const,
      dependencies: {
        '@nimir/references': `file:${tarball.replace(/\\/g, '/')}`,
        'fake-indexeddb': '^6.2.5',
        'idb-keyval': '^6.2.2',
      },
    };
    writeFileSync(path.join(bunTmp, 'package.json'), JSON.stringify(pkg, null, 2));
    run('pnpm', ['install', '--ignore-scripts'], bunTmp);

    const code = `
      import { defineReferences, ReferenceCache } from '@nimir/references';
      import { createMemoryCache } from '@nimir/references/in-memory';

      if (typeof defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = ReferenceCache.new(createMemoryCache());
      if (!cache) throw new Error('cache missing');

      console.log('ok');
    `;

    writeFileSync(path.join(bunTmp, 'main.ts'), code);
    const { stdout } = run('bun', ['run', 'main.ts'], bunTmp);
    expect(stdout.trim()).toBe('ok');
  });

  it('bundles and runs in browser', { timeout: 60000 }, async () => {
    const browserTmp = path.join(tmp, 'browser');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(browserTmp, { recursive: true });

    const pkg = {
      type: 'module' as const,
      dependencies: {
        '@nimir/references': `file:${tarball.replace(/\\/g, '/')}`,
        'fake-indexeddb': '^6.2.5',
        'idb-keyval': '^6.2.2',
        vite: '^6.0.0',
        playwright: '^1.49.0',
      },
    };
    writeFileSync(path.join(browserTmp, 'package.json'), JSON.stringify(pkg, null, 2));
    run('pnpm', ['install', '--ignore-scripts'], browserTmp);

    writeFileSync(
      path.join(browserTmp, 'index.html'),
      '<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>',
    );
    writeFileSync(
      path.join(browserTmp, 'main.js'),
      `
      import { defineReferences, ReferenceCache } from '@nimir/references';
      import { createMemoryCache } from '@nimir/references/in-memory';
      import 'fake-indexeddb/auto';
      import { createIdbKeyvalCache } from '@nimir/references/idb-keyval';

      if (typeof defineReferences !== 'function') throw new Error('defineReferences missing');
      const cache = ReferenceCache.new(createMemoryCache());
      if (!cache) throw new Error('cache missing');
      ReferenceCache.new(createIdbKeyvalCache({ database: 'db', table: 'tbl' }));

      document.body.dataset.status = 'ok';
    `,
    );
    writeFileSync(
      path.join(browserTmp, 'vite.config.js'),
      `export default { root: '.', build: { outDir: 'dist' } };`,
    );

    run('pnpm', ['exec', 'vite', 'build'], browserTmp);

    const { chromium } = await import('playwright');
    const { createServer } = await import('node:http');
    const { createReadStream, existsSync } = await import('node:fs');
    const distDir = path.join(browserTmp, 'dist');
    const port = 34567;
    const mime = (p: string) => (p.endsWith('.js') ? 'application/javascript' : 'text/html');
    const server = createServer((req, res) => {
      const url = req.url?.split('?')[0] ?? '/';
      const file = path.join(distDir, url === '/' ? 'index.html' : url.replace(/^\//, ''));
      if (!file.startsWith(distDir) || !existsSync(file)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': mime(file) });
      createReadStream(file).pipe(res);
    });
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()));

    try {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}`);
      await page.waitForFunction(() => document.body.dataset.status === 'ok', { timeout: 10000 });
      await browser.close();
    } finally {
      server.close();
    }
  });
});
