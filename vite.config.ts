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
      fileName: (format, name) => `${name}.${format}.js`,
      formats: ['es', 'cjs'],
    },
  },
  plugins: [dts({ tsconfigPath: 'tsconfig.library.json' })],
  test: { setupFiles: ['./src/vitest-setup.ts'] },
});
