import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'rolldown-vite';

export default defineConfig({
  root: path.resolve(__dirname, 'src/samples'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    open: '/react-index.html',
  },
});
