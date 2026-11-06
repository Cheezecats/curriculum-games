import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks',
    // CPU-only training fixtures must not compete for the same machine budget.
    fileParallelism: false,
  },
  build: { chunkSizeWarningLimit: 1100 },
});
