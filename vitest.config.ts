import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'sources/**/*.spec.ts', 'tools/**/*.spec.ts'],
    exclude: ['src/app/app.spec.ts'],
  },
});
