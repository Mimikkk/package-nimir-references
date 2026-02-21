import path from 'node:path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

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
  plugins: [dts({ tsconfigPath: 'tsconfig.library.json' })],
  test: { setupFiles: ['./src/vitest-setup.ts'] },
});
