import { defineConfig } from '@playwright/test';

/**
 * Playwright Configuration for E2E Testing with Backend Integration
 * 
 * This configuration enables automated UI testing that uses real backend data.
 * Tests will interact with the actual backend API running on port 4004.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially to avoid multiple browser windows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Always use 1 worker for sequential execution
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  use: {
    baseURL: 'http://localhost:8070',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // API base URL for backend calls
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        // Use Playwright's bundled Chromium browser (not system Chrome)
        // Don't use devices['Desktop Chrome'] as it might use system Chrome
        viewport: { width: 1280, height: 720 },
        // Explicitly avoid using system Chrome channel
        // Playwright will use its bundled Chromium automatically
      },
    },
  ],

  // Run local dev servers before starting tests. CI overrides the commands to serve the production
  // builds instead (E2E_FRONTEND_COMMAND / E2E_BACKEND_COMMAND, see .github/workflows/ci.yml).
  webServer: [
    {
      command: process.env.E2E_FRONTEND_COMMAND || 'npm run dev',
      url: 'http://localhost:8070',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: process.env.E2E_BACKEND_COMMAND || 'cd server/pro-act-backend && npm run start:dev',
      url: 'http://localhost:4004/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});

