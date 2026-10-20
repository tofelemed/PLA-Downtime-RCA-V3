import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// src/test/integration/* talks to a running backend (:4004 with seeded users) and belongs to the e2e layer,
// so the unit run leaves it out; run it on demand with PROACT_API_INTEGRATION=1 npx vitest run src/test/integration
const runApiIntegration = process.env.PROACT_API_INTEGRATION === '1';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // room for the 5 s Testing Library waits (src/test/setup.ts) inside one test
    testTimeout: 20_000,
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'server/**/*',
      '**/*.d.ts',
      '**/*.config.*',
      ...(runApiIntegration ? [] : ['src/test/integration/**']),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'server/**/*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

