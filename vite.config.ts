import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'build',
    lib: {
      entry: 'src/references.ts',
      name: 'references',
      fileName: format => `references.${format}.js`,
      formats: ['es', 'cjs', 'umd'],
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
