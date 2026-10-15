import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VITE_BASE define o caminho base da publicação (ex.: /cryptonet-lab/ no GitHub Pages).
// O roteamento usa HashRouter, portanto recarregar qualquer página funciona em hospedagem estática.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 30000,
    setupFiles: ['tests/setup.ts'],
  },
});
