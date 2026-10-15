import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { loginViaUI } from '../test-utils/auth-helpers';
import { PLANTS } from './support/admin-helpers';

const { DEMO_PERSONAS, DEMO_PERSONA_PASSWORD } = createRequire(import.meta.url)(
  '../../server/pro-act-backend/scripts/demo-personas/persona-catalog',
) as typeof import('../../server/pro-act-backend/scripts/demo-personas/persona-catalog');

const { hdpePersonas } = createRequire(import.meta.url)(
  '../../server/pro-act-backend/scripts/demo-personas/hdpe-personas',
) as typeof import('../../server/pro-act-backend/scripts/demo-personas/hdpe-personas');
const personas = process.env.HDPE_ONLY === '1' ? hdpePersonas() : DEMO_PERSONAS;

/** Every catalogued person signs in through the real form; capture each role's landing page. */
for (const persona of personas) {
  for (const [index, user] of persona.users.entries()) {
    test(`${persona.key}: ${user.name} can establish their own scoped session`, async ({ page }) => {
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('response', (response) => {
        if (response.url().includes('/api/') && response.status() >= 500) {
          failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
        }
        if (/\/api\/v2\/organizations\/[a-f0-9-]+$/.test(response.url()) && response.status() === 404) {
          failures.push('Session requested a nonexistent organization detail route');
        }
      });
      await loginViaUI(page, user.email, DEMO_PERSONA_PASSWORD);
      await expect(page.getByRole('button', { name: /^Plant: / })).toBeVisible();
      await expect(page.getByRole('banner')).toContainText(user.name);
      const identity = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('proact_auth_state') ?? '{}') as {
          user?: { email?: string; role?: string; tenantId?: string };
        };
        return saved.user;
      });
      expect(identity?.email).toBe(user.email);
      expect(identity?.role).toBe(user.legacyRole);
      await expect(page.locator('main')).toBeVisible();
      if (process.env.HDPE_ONLY === '1') {
        expect(identity?.tenantId).toBe(PLANTS.demo.id);
        await expect(page.getByTestId('plant-current-label')).toHaveText('HDPE');
        if (persona.key === 'viewer') await expect(page.getByRole('banner').getByText('Read-only', { exact: true })).toBeVisible();
      }
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      if (index === 0) await page.screenshot({ path: test.info().outputPath(`${persona.key}-landing.png`), fullPage: true });
      expect(failures).toEqual([]);
    });
  }
}
