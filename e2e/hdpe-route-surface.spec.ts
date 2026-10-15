import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { loginViaUI } from './test-utils/auth-helpers';

const routeRoot = join(process.cwd(), 'src/app/routes');
const routes = [...new Set(readdirSync(routeRoot)
  .filter((name) => name.endsWith('.tsx') && name !== 'dev.tsx')
  .flatMap((name) => [...readFileSync(join(routeRoot, name), 'utf8')
    .matchAll(/\bpath:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))
  .filter((path) => !path.includes(':') && !path.includes('*')))].sort();

/** Every static production route, including empty create forms; no form is submitted. */
test.describe('HDPE read-only route surface', () => {
  test.skip(process.env.HDPE_ONLY !== '1', 'Run against the final single-plant seed');
  for (const route of routes) {
    test(`${route} renders without failed API calls or automatic writes`, async ({ page }) => {
      test.setTimeout(90_000);
      await loginViaUI(page, 'helena.fischer@demo.acme.com', 'Persona-2026!demo');
      const failures: string[] = [];
      const writes: string[] = [];
      const requests: Array<{ method: string; path: string; status: number }> = [];
      await page.route('**/api/**', async (intercepted) => {
        const request = intercepted.request();
        const path = new URL(request.url()).pathname;
        const method = request.method();
        const readOnlyPost = method === 'POST' && (
          path === '/api/auth/refresh'
          || path === '/api/v2/rules/validate'
          || /^\/api\/v2\/(?:source-mappings|attribute-mappings|calendars|uncertainty-budgets)\/preview$/.test(path)
          || /^\/api\/v2\/signals\/[^/]+\/preview$/.test(path)
        );
        if (['GET', 'HEAD', 'OPTIONS'].includes(method) || readOnlyPost) {
          await intercepted.continue();
          return;
        }
        writes.push(`${method} ${path}`);
        await intercepted.abort('blockedbyclient');
      });
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('requestfailed', (request) => {
        const path = new URL(request.url()).pathname;
        const reason = request.failure()?.errorText ?? 'Unknown transport error';
        if (path.startsWith('/api/') && !reason.includes('ERR_ABORTED')) {
          failures.push(`${request.method()} ${path}: ${reason}`);
        }
      });
      page.on('response', (response) => {
        const path = new URL(response.url()).pathname;
        if (!path.startsWith('/api/')) return;
        const method = response.request().method();
        requests.push({ method, path, status: response.status() });
        if (response.status() >= 400) failures.push(`${method} ${path}: ${response.status()}`);
      });
      await page.goto(route);
      await expect(page.getByTestId('plant-current-label')).toHaveText('HDPE');
      await expect(page.getByRole('status', { name: 'Loading page', exact: true })).toBeHidden({ timeout: 60_000 });
      const main = page.locator('main');
      await expect(main).toBeVisible();
      await expect.poll(async () => (await main.innerText()).trim().length, { timeout: 30_000 }).toBeGreaterThan(20);
      await page.waitForLoadState('networkidle', { timeout: 20_000 });
      await expect(main.getByRole('heading', { name: /^(404|page not found|access denied)$/i })).toHaveCount(0);
      await test.info().attach('route-api-responses', {
        body: Buffer.from(JSON.stringify({ route, requests, failures, writes }, null, 2)),
        contentType: 'application/json',
      });
      const screenshotPath = test.info().outputPath('route.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await test.info().attach('route-screenshot', { path: screenshotPath, contentType: 'image/png' });
      expect(failures, `API and browser failures on ${route}`).toEqual([]);
      expect(writes, `Opening ${route} must not change plant records`).toEqual([]);
    });
  }
});
