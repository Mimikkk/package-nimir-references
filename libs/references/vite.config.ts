import { copyFileSync } from 'node:fs';
import path from 'node:path';
import dts from 'vite-plugin-dts';
import { defineConfig, type Plugin } from 'vitest/config';

const copyRootFiles = (): Plugin => ({
  name: 'copy-root-files',
  closeBundle() {
    copyFileSync(path.resolve(__dirname, '../../readme.md'), path.resolve(__dirname, 'readme.md'));
    copyFileSync(path.resolve(__dirname, '../../license'), path.resolve(__dirname, 'LICENSE'));
  },
});

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: 'build',
    lib: {
      entry: {
        references: 'src/exports/lib.ts',
        react: 'src/exports/react.ts',
        'in-memory': 'src/exports/in-memory.ts',
        'idb-keyval': 'src/exports/idb-keyval.ts',
        redis: 'src/exports/redis.ts',
      },
      fileName: (format, name) => {
        if (format === 'es') return `${name}.es.js`;
        // In a `"type": "module"` package, CommonJS outputs must use `.cjs`.
        return `${name}.cjs`;
      },
      formats: ['es', 'cjs'],
    },
  },
  plugins: [dts({ tsconfigPath: 'tsconfig.library.json' }), copyRootFiles()],
  test: { setupFiles: ['./src/vitest-setup.ts'] },
});
