/**
 * Production Module E2E Tests
 * 
 * Tests production-related features using real backend data.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest } from './test-utils/api-helpers';
import { fillPlantTime } from './personas/support/event-hub-ui';

test.describe('Production Module', () => {
  let fixture: TestFixture;
  let productionPlan: { id?: string } | undefined;

  test.beforeAll(async () => {
    fixture = await createTestFixture();
    
    // Create a test production plan (requires unitId as UUID)
    productionPlan = await apiRequest<{ id?: string }>('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        tenantId: fixture.tenant.id,
        unitId: fixture.unit.id, // Required: must be a UUID
        name: `E2E Test Plan ${Date.now()}`,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
  });

  test.afterAll(async () => {
    // Cleanup production plan
    if (productionPlan?.id) {
      try {
        await apiRequest(`/production-plans/${productionPlan.id}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch (error) {
        console.warn('Failed to cleanup production plan:', error);
      }
    }
    await fixture.cleanup();
  });

  // the Event Hub is v2 only (7801cae): a new event is its own page (/events/new) and opens its event page
  test('should create production event via UI', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/events');
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'New event' }).click();
    const form = page.getByTestId('event-form');
    await expect(form).toBeVisible({ timeout: 30_000 });
    // any unit of the acting plant (the unit list arrives after the page renders)
    const units = form.locator('#unitId option:not([value=""])');
    await expect(units.first()).toBeAttached({ timeout: 30_000 });
    await form.locator('#unitId').selectOption((await units.first().getAttribute('value')) ?? '');
    const day = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await fillPlantTime(form, 'Start', `${day}T08:00`);
    await fillPlantTime(form, 'End (empty = still running)', `${day}T08:30`);
    const eventDescription = `E2E Test Event ${Date.now()}`;
    await form.locator('#description').fill(eventDescription);
    await form.getByRole('button', { name: 'Save' }).click();
    const detail = page.getByTestId('event-detail');
    await expect(detail).toBeVisible({ timeout: 30_000 });
    await expect(detail.getByText(eventDescription).first()).toBeVisible();
  });

  // The v1 Production Plans screen was replaced by the v2 plans list (plans are created, edited, approved
  // and accounted there: e2e/personas/engineer-planning.spec.ts, manager-1-plans.spec.ts); the old address
  // still opens it.
  test('the old Production Plans address opens the v2 plans list', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/production-plans');
    await expect(page).toHaveURL(/\/planning\?tab=plans/);
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plans-tab')).toBeVisible({ timeout: 60_000 });
  });
});

