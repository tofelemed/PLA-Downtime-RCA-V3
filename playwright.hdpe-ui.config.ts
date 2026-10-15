import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const runName = process.env.HDPE_UI_RUN ?? 'ui-pilot';
if (!/^[a-z0-9-]+$/.test(runName)) throw new Error('HDPE_UI_RUN must be a simple evidence folder name.');

/** Business mutations run against a cloned HDPE database, never the final live plant. */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:8071', trace: 'retain-on-failure' },
  webServer: [],
  outputDir: `test-results/hdpe-followup/${runName}-artifacts`,
  reporter: [
    ['list'],
    ['json', { outputFile: `test-results/hdpe-followup/${runName}.json` }],
  ],
});
