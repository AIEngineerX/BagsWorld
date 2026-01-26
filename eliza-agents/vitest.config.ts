import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@bagsworld': resolve(__dirname, '../src'),
    },
  },
  server: {
    deps: {
      // Include parent directory characters so vitest can process them
      inline: [/\.\.\/.*src\/characters/],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    deps: {
      // Force vitest to transform parent directory TypeScript files
      inline: [/\.\.\/.*src\/characters/],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
