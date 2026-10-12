/**
 * Production Module E2E Tests
 * 
 * Tests production-related features using real backend data.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest } from './test-utils/api-helpers';

test.describe('Production Module', () => {
  let fixture: TestFixture;
  let productionPlan: any;

  test.beforeAll(async () => {
    fixture = await createTestFixture();
    
    // Create a test production plan (requires unitId as UUID)
    productionPlan = await apiRequest('/production-plans', {
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

  test('should create production event via UI', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/events');
    
    // Wait for events page to load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1, button, [role="tablist"]', { timeout: 10000 });
    await page.waitForTimeout(2000); // Give time for data to load
    
    // Event Hub uses tabs - make sure we're on the right tab (ProductionLoss is default)
    // Click create button - look for "Create Event" or "Add Event" button
    const createButtons = page.locator('button:has-text("Create Event"), button:has-text("Create"), button:has-text("Add Event")');
    const createButtonCount = await createButtons.count();
    
    if (createButtonCount > 0) {
      await createButtons.first().click({ timeout: 10000 });
    } else {
      // Try finding button with Plus icon
      const plusButton = page.locator('button:has(svg)').filter({ hasText: /Create|Add/i }).first();
      await plusButton.click({ timeout: 5000 });
    }
    
    // Wait for dialog to fully open
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500); // Wait for dialog animation
    
    // Event form has many fields - find description or unit field
    // Description is usually a textarea or input
    const descriptionInput = page.locator('[role="dialog"] textarea, [role="dialog"] input[type="text"]').first();
    const eventDescription = `E2E Test Event ${Date.now()}`;
    await descriptionInput.fill(eventDescription);
    
    // Select unit if dropdown exists (required field)
    // Event Hub uses Select components (combobox)
    const unitSelectTrigger = page.locator('[role="dialog"] button[role="combobox"], [role="dialog"] select[name="unitId"]').first();
    if (await unitSelectTrigger.isVisible({ timeout: 3000 })) {
      if (await unitSelectTrigger.getAttribute('role') === 'combobox') {
        await unitSelectTrigger.click();
        await page.waitForTimeout(1000); // Wait for dropdown to open
        // Wait for options to appear
        await page.waitForSelector('[role="option"]', { timeout: 5000 });
        // Try to find unit by name or value - use a more flexible selector
        const unitOptions = page.locator('[role="option"]');
        const optionCount = await unitOptions.count();
        let unitSelected = false;
        
        // Try to find by text first
        for (let i = 0; i < optionCount; i++) {
          const option = unitOptions.nth(i);
          const text = await option.textContent();
          if (text && (text.includes(fixture.unit.name) || text.includes(fixture.unit.code))) {
            await option.click();
            unitSelected = true;
            break;
          }
        }
        
        // If not found by text, try by value attribute
        if (!unitSelected) {
          const unitOptionByValue = page.locator(`[role="option"][value="${fixture.unit.id}"]`).first();
          if (await unitOptionByValue.isVisible({ timeout: 2000 })) {
            await unitOptionByValue.click();
            unitSelected = true;
          }
        }
        
        // If still not found, click first available option (fallback)
        if (!unitSelected && optionCount > 0) {
          await unitOptions.first().click();
        }
      } else {
        await unitSelectTrigger.selectOption({ value: fixture.unit.id });
      }
    }
    
    // Submit - look for submit button in dialog
    await page.waitForTimeout(300);
    const submitButton = page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Create")');
    await submitButton.click({ timeout: 5000 });
    
    // Wait for dialog to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Verify event appears - scroll to it
    const eventLocator = page.locator(`text=${eventDescription}`).first();
    await eventLocator.scrollIntoViewIfNeeded();
    await expect(eventLocator).toBeVisible({ timeout: 10000 });
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

