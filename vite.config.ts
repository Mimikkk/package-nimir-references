import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'build',
    lib: {
      entry: {
        '.': 'src/exports/lib.ts',
        'idb-keyval': 'src/exports/idb-keyval.ts',
        'in-memory': 'src/exports/in-memory.ts',
      },
      fileName: (format, name) => `${name}.${format}.js`,
      formats: ['es', 'cjs'],
    },
  },
  plugins: [
    dts({
      tsconfigPath: 'tsconfig.library.json',
    }),
  ],
  test: {
    globals: true,
    setupFiles: ['./src/vitest-setup.ts'],
  },
});
