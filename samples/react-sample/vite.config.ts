import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const referencesSrc = path.resolve(__dirname, '../../libs/references/src');

  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    server: { port: 3000, strictPort: true },
    resolve: {
      ...(isDev && {
        conditions: ['development', 'import', 'module', 'browser', 'default'],
        alias: { src: referencesSrc },
      }),
    },
  };
});
