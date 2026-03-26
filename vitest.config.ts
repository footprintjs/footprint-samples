import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globals: false,
    environment: 'node',
    testTimeout: 15000,
    snapshotOptions: {
      snapshotFormat: {
        printBasicPrototype: false,
      },
    },
  },
});
