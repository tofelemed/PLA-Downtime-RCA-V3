import { expect, test, type Page } from '@playwright/test';
import { loginViaUI } from './test-utils/auth-helpers';

const ADMIN = 'helena.fischer@demo.acme.com';
const PASSWORD = 'Persona-2026!demo';
const outage = { status: 503, contentType: 'application/json', body: '{"message":"Temporary test outage"}' };

async function credentialsSaved(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('proact_auth_state') ?? 'null');
    return Boolean(value?.tokens?.accessToken && value?.tokens?.refreshToken);
  });
}

async function expireAccessToken(page: Page) {
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('proact_auth_state') ?? 'null');
    saved.tokens.expiresAt = Date.now() - 1;
    localStorage.setItem('proact_auth_state', JSON.stringify(saved));
  });
}

test.describe('HDPE session recovery without plant mutations', () => {
  test.skip(process.env.HDPE_ONLY !== '1', 'Requires the final HDPE personas');

  test('metadata outage after valid login retains credentials and offers a working retry', async ({ page }) => {
    await page.route('**/api/v2/organizations?*', (route) => route.fulfill(outage));
    await page.goto('/dashboard');
    await page.locator('#email').fill(ADMIN);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Secure sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Unable to load your session' })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    expect(await credentialsSaved(page)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('session-recovery.png'), fullPage: true });
    await page.unroute('**/api/v2/organizations?*');
    await page.getByRole('button', { name: 'Retry session', exact: true }).click();
    await expect(page.getByRole('banner')).toContainText('Helena Fischer');
    await expect(page.getByTestId('plant-current-label')).toHaveText('HDPE');
  });

  test('profile outage never restores cached permissions and sign-out clears the saved session', async ({ page }) => {
    await loginViaUI(page, ADMIN, PASSWORD);
    await page.route('**/api/auth/profile', (route) => route.fulfill(outage));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Unable to load your session' })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    expect(await credentialsSaved(page)).toBe(true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.locator('#email')).toBeVisible();
    expect(await credentialsSaved(page)).toBe(false);
  });

  test('refresh service outage is recoverable without signing in again', async ({ page }) => {
    await loginViaUI(page, ADMIN, PASSWORD);
    await expireAccessToken(page);
    await page.route('**/api/auth/refresh', (route) => route.fulfill(outage));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Unable to load your session' })).toBeVisible();
    expect(await credentialsSaved(page)).toBe(true);
    await page.unroute('**/api/auth/refresh');
    await page.getByRole('button', { name: 'Retry session', exact: true }).click();
    await expect(page.getByRole('banner')).toContainText('Helena Fischer');
  });

  test('invalid refresh clears the session instead of exposing cached administrator controls', async ({ page }) => {
    await loginViaUI(page, ADMIN, PASSWORD);
    await expireAccessToken(page);
    await page.route('**/api/auth/refresh', (route) => route.fulfill({
      status: 401, contentType: 'application/json', body: '{"message":"Invalid refresh token"}',
    }));
    await page.reload();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    expect(await credentialsSaved(page)).toBe(false);
  });
});
