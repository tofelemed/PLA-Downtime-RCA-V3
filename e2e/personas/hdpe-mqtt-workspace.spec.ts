import { test, expect } from '@playwright/test';
import { API, signIn } from './support/admin-helpers';
import { INT_USERS } from './support/integration-world';

const connectionPath = '/connectivity/connections/cb40dc90-2fc9-4dd1-83a6-169380242689';

test.describe('HDPE MQTT grouped profile and responsive state', () => {
  test.beforeEach(() => test.skip(!API.includes(':4006/'), 'Run against the isolated HDPE UI database on port 4006.'));
  for (const width of [1280, 390]) {
    test(`profile groups retain local fields and fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, INT_USERS.elena);
      await page.goto(`${connectionPath}?tab=profile`);
      await expect(page.getByTestId('profile-editor')).toBeVisible();
      const errors: string[] = []; const writes: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (request.url().includes('/v2/connections/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) writes.push(request.method());
      });
      await page.screenshot({ path: test.info().outputPath(`profile-collapsed-${width}.png`), fullPage: true });
      for (const group of ['time', 'fields', 'maps']) {
        await page.getByTestId(`profile-section-${group}`).getByRole('button').first().click();
      }
      const original = await page.locator('#pp-future').inputValue();
      const changed = original === '121' ? '122' : '121';
      await page.locator('#pp-future').fill(changed);
      const timeToggle = page.getByTestId('profile-section-time').getByRole('button').first();
      await timeToggle.click();
      await expect(page.locator('#pp-future')).toBeHidden();
      await timeToggle.click();
      await expect(page.locator('#pp-future')).toHaveValue(changed);
      await page.getByTestId('profile-field-add').click();
      const field = page.getByTestId('profile-field-row').last();
      await field.getByRole('textbox', { name: 'JSON path', exact: true }).fill('payload.pressure');
      await page.getByTestId('state-map-add').click();
      const row = page.getByTestId('state-map-row').last();
      await row.getByRole('textbox', { name: 'Raw token', exact: true }).fill('pressure_ok');
      await row.getByLabel('DT01 state', { exact: true }).fill('running');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'expanded profile overflow').toBeLessThanOrEqual(1);
      await page.screenshot({ path: test.info().outputPath(`profile-expanded-${width}.png`), fullPage: true });
      await page.getByTestId('profile-reset').click();
      await expect(page.getByTestId('profile-editor')).toHaveAttribute('data-dirty', 'false');
      await expect(page.locator('#pp-future')).toHaveValue(original);
      await page.reload();
      await expect(page.getByTestId('profile-editor')).toBeVisible();
      await page.getByRole('tab', { name: 'Subscription', exact: true }).click();
      await page.getByTestId('mqtt-technical-details').locator('summary').click();
      await expect(page.getByTestId('mqtt-client-id')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'subscription overflow').toBeLessThanOrEqual(1);
      await page.screenshot({ path: test.info().outputPath(`subscription-${width}.png`), fullPage: true });
      expect(errors).toEqual([]); expect(writes).toEqual([]);
    });
  }
});
