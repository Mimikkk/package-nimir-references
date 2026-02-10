import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'build',
    lib: {
      entry: {
        references: 'src/exports/lib.ts',
        'in-memory': 'src/exports/in-memory.ts',
        'idb-keyval': 'src/exports/idb-keyval.ts',
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
