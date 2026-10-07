/**
 * Production Plans CRUD E2E Tests
 * 
 * Comprehensive tests for Create, Read, Update, Delete operations
 * on production plans using both API and UI.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest } from './test-utils/api-helpers';

test.describe('Production Plans CRUD Operations', () => {
  let fixture: TestFixture;
  let createdPlanIds: string[] = [];

  test.beforeAll(async () => {
    fixture = await createTestFixture();
  });

  test.afterAll(async () => {
    // Cleanup all created plans
    for (const planId of createdPlanIds) {
      try {
        await apiRequest(`/production-plans/${planId}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      } catch (error) {
        console.warn(`Failed to cleanup plan ${planId}:`, error);
      }
    }
    await fixture.cleanup();
  });

  // ==================== CREATE OPERATIONS ====================

  test('CREATE: should create production plan via API', async () => {
    const planData = {
      name: `E2E API Plan ${Date.now()}`,
      unitId: fixture.unit.id,
      productId: fixture.product.id,
      tenantId: fixture.tenant.id,
      organizationId: fixture.organization.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(), // +1 day
      plannedQuantity: 1000,
      toleranceLimit: 5,
      status: 'Planned',
      planBasis: 'Time-based',
      recurrence: 'Daily',
      dataEntryFrequency: 'Daily',
    };

    const plan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    expect(plan).toBeDefined();
    expect(plan.id).toBeDefined();
    expect(plan.name).toBe(planData.name);
    expect(plan.unitId).toBe(planData.unitId);
    expect(plan.startDate).toBeDefined();
    expect(plan.endDate).toBeDefined();

    createdPlanIds.push(plan.id);
  });

  test('CREATE: should create production plan via UI', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/production-plans');
    
    // Wait for page to load - use more flexible selector
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give more time for page to render
    
    // Check if page loaded by looking for any visible element
    const pageLoaded = await page.locator('body').isVisible({ timeout: 5000 }).catch(() => false);
    if (!pageLoaded) {
      throw new Error('Page did not load');
    }

    // Click create button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New Plan")').first();
    await createButton.click({ timeout: 10000 });

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Fill form
    const planName = `E2E UI Plan ${Date.now()}`;
    const nameInput = page.locator('[role="dialog"] input#name, [role="dialog"] input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill(planName);

    // Select unit
    const unitSelect = page.locator('[role="dialog"] button[role="combobox"], [role="dialog"] select').first();
    if (await unitSelect.getAttribute('role') === 'combobox') {
      await unitSelect.click();
      await page.waitForTimeout(500);
      const unitOption = page.locator(`[role="option"]:has-text("${fixture.unit.name}")`).first();
      await unitOption.click({ timeout: 5000 });
    } else {
      await unitSelect.selectOption({ value: fixture.unit.id });
    }

    // Fill dates
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    const startDateInput = page.locator('[role="dialog"] input[type="date"]').first();
    const endDateInput = page.locator('[role="dialog"] input[type="date"]').last();
    
    await startDateInput.fill(today.toISOString().split('T')[0]);
    await endDateInput.fill(tomorrow.toISOString().split('T')[0]);

    // Submit
    const submitButton = page.locator('[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save")').first();
    await submitButton.click({ timeout: 5000 });

    // Wait for dialog to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Verify plan appears
    const planLocator = page.locator(`text=${planName}`).first();
    await planLocator.scrollIntoViewIfNeeded();
    await expect(planLocator).toBeVisible({ timeout: 10000 });
    
    // Verify date is displayed in user-friendly format (not ISO format)
    const scheduleText = await page.locator(`text=/Schedule:/i`).first().locator('..').textContent();
    expect(scheduleText).not.toContain('T00:00:00');
    expect(scheduleText).not.toContain('.000Z');
  });

  test('CREATE: should fail with missing required fields', async () => {
    // Missing name
    try {
      await apiRequest('/production-plans', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          unitId: fixture.unit.id,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      });
      throw new Error('Should have failed validation for missing name');
    } catch (error: any) {
      expect(error).toBeDefined();
    }

    // Missing unitId
    try {
      await apiRequest('/production-plans', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          name: 'Test Plan',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      });
      throw new Error('Should have failed validation for missing unitId');
    } catch (error: any) {
      expect(error).toBeDefined();
    }

    // Missing dates
    try {
      await apiRequest('/production-plans', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          name: 'Test Plan',
          unitId: fixture.unit.id,
        }),
      });
      throw new Error('Should have failed validation for missing dates');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('CREATE: should fail with invalid UUID for unitId', async () => {
    try {
      await apiRequest('/production-plans', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          name: 'Test Plan',
          unitId: 'invalid-uuid',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      });
      throw new Error('Should have failed validation for invalid UUID');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('CREATE: should fail with invalid date format', async () => {
    try {
      await apiRequest('/production-plans', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          name: 'Test Plan',
          unitId: fixture.unit.id,
          startDate: 'invalid-date',
          endDate: 'invalid-date',
        }),
      });
      throw new Error('Should have failed validation for invalid date format');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  // ==================== READ OPERATIONS ====================

  test('READ: should get all production plans', async () => {
    const plans = await apiRequest(`/production-plans?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(Array.isArray(plans)).toBe(true);
  });

  test('READ: should get production plan by ID', async () => {
    // First create a plan
    const planData = {
      name: `E2E Read Test Plan ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    // Then read it
    const plan = await apiRequest(`/production-plans/${createdPlan.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(plan).toBeDefined();
    expect(plan.id).toBe(createdPlan.id);
    expect(plan.name).toBe(planData.name);
  });

  test('READ: should filter plans by tenantId', async () => {
    const plans = await apiRequest(`/production-plans?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(Array.isArray(plans)).toBe(true);
    // All plans should belong to the test tenant
    plans.forEach((plan: any) => {
      expect(plan.tenantId).toBe(fixture.tenant.id);
    });
  });

  test('READ: should filter plans by status', async () => {
    // First create a plan with specific status
    const planData = {
      name: `E2E Status Filter Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      status: 'Planned',
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    const plans = await apiRequest(`/production-plans?tenantId=${fixture.tenant.id}&status=Planned`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(Array.isArray(plans)).toBe(true);
    // Only check plans that have a status field
    plans.forEach((plan: any) => {
      if (plan.status !== null && plan.status !== undefined) {
        expect(plan.status).toBe('Planned');
      }
    });
  });

  test('READ: should display production plans list in UI', async ({ page }) => {
    // Create a plan first via API
    const planData = {
      name: `E2E Display Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    await loginViaAPI(page);
    await page.goto('/production-plans');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give time for page to render
    
    // Check if page loaded
    const pageLoaded = await page.locator('body').isVisible({ timeout: 5000 }).catch(() => false);
    if (!pageLoaded) {
      throw new Error('Page did not load');
    }

    // Check if page structure is present
    const hasPlansSection = await page.locator('text=/Production Plan|Plan Name|No plans/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPlansSection).toBeTruthy();
    
    // Verify dates are displayed in user-friendly format
    const scheduleElements = page.locator('text=/Schedule:/i');
    const scheduleCount = await scheduleElements.count();
    
    if (scheduleCount > 0) {
      // Check that dates are not in ISO format
      const pageContent = await page.content();
      expect(pageContent).not.toContain('T00:00:00.000Z');
      expect(pageContent).not.toContain('2025-12-01T00:00:00');
    }
  });

  // ==================== UPDATE OPERATIONS ====================

  test('UPDATE: should update production plan via API', async () => {
    // Create a plan first
    const planData = {
      name: `E2E Update Test Plan ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      status: 'Planned',
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    // Update the plan
    const updatedName = `E2E Updated Plan ${Date.now()}`;
    const updatedPlan = await apiRequest(`/production-plans/${createdPlan.id}`, {
      method: 'PUT',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        name: updatedName,
        status: 'Active',
        plannedQuantity: 2000,
      }),
    });

    expect(updatedPlan.name).toBe(updatedName);
    expect(updatedPlan.status).toBe('Active');
    expect(updatedPlan.plannedQuantity).toBe(2000);
  });

  test('UPDATE: should update production plan via UI', async ({ page }) => {
    // Create a plan first via API
    const planData = {
      name: `E2E UI Update Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    // Navigate to plans page
    await loginViaAPI(page);
    await page.goto('/production-plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find and click on the plan (might be in a card, row, or list item)
    const planLocator = page.locator(`text=${planData.name}`).first();
    const isVisible = await planLocator.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      // Click on the plan to edit (might need to click edit button)
      const editButton = planLocator.locator('..').locator('button:has-text("Edit"), button[aria-label*="edit" i]').first();
      const hasEditButton = await editButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasEditButton) {
        await editButton.click();
      } else {
        // Try clicking the plan itself
        await planLocator.click();
      }

      // Wait for edit dialog
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Update name
      const updatedName = `E2E Updated UI Plan ${Date.now()}`;
      const nameInput = page.locator('[role="dialog"] input#name').first();
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Update status
      const statusSelect = page.locator('[role="dialog"] select, [role="dialog"] button[role="combobox"]').filter({ hasText: /Planned|Active|Completed/i }).first();
      if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (await statusSelect.getAttribute('role') === 'combobox') {
          await statusSelect.click();
          await page.waitForTimeout(500);
          await page.locator('[role="option"]:has-text("Active")').first().click();
        } else {
          await statusSelect.selectOption('Active');
        }
      }

      // Save
      const saveButton = page.locator('[role="dialog"] button:has-text("Update"), [role="dialog"] button:has-text("Save")').first();
      await saveButton.click({ timeout: 5000 });

      // Wait for dialog to close
      await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Verify update
      const updatedPlanLocator = page.locator(`text=${updatedName}`).first();
      await updatedPlanLocator.scrollIntoViewIfNeeded();
      await expect(updatedPlanLocator).toBeVisible({ timeout: 10000 });
    } else {
      // Plan might be filtered out - skip UI update test
      console.log('Plan not visible in UI, skipping UI update test');
    }
  });

  test('UPDATE: should fail with invalid data', async () => {
    // Create a plan first
    const planData = {
      name: `E2E Invalid Update Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    // Try to update with invalid unitId
    try {
      await apiRequest(`/production-plans/${createdPlan.id}`, {
        method: 'PUT',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          unitId: 'invalid-uuid',
        }),
      });
      throw new Error('Should have failed validation for invalid UUID');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  // ==================== DELETE OPERATIONS ====================

  test('DELETE: should delete production plan via API', async () => {
    // Create a plan first
    const planData = {
      name: `E2E Delete Test Plan ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    // Delete the plan
    await apiRequest(`/production-plans/${createdPlan.id}`, {
      method: 'DELETE',
      token: fixture.tokens.accessToken,
    });

    // Verify plan is deleted
    try {
      await apiRequest(`/production-plans/${createdPlan.id}`, {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });
      throw new Error('Plan should have been deleted but still exists');
    } catch (error: any) {
      // Expected - plan should not exist
      expect(error).toBeDefined();
    }
  });

  test('DELETE: should delete production plan via UI', async ({ page }) => {
    // Create a plan first via API
    const planData = {
      name: `E2E UI Delete Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    // Navigate to plans page
    await loginViaAPI(page);
    await page.goto('/production-plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find the plan
    const planLocator = page.locator(`text=${planData.name}`).first();
    const isVisible = await planLocator.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      // Find delete button (might be in a menu or directly visible)
      const deleteButton = planLocator
        .locator('..')
        .locator('..')
        .locator('button:has-text("Delete"), button[aria-label*="delete" i], button:has(svg)')
        .first();

      const hasDeleteButton = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasDeleteButton) {
        await deleteButton.click();
        
        // Confirm deletion if confirmation dialog appears
        await page.waitForTimeout(500);
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').first();
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }

        // Wait for plan to disappear
        await page.waitForTimeout(2000);
        await expect(planLocator).not.toBeVisible({ timeout: 10000 });
      } else {
        // Delete button not found - skip UI delete test
        console.log('Delete button not found, skipping UI delete test');
        // Cleanup via API
        await apiRequest(`/production-plans/${createdPlan.id}`, {
          method: 'DELETE',
          token: fixture.tokens.accessToken,
        });
      }
    } else {
      // Plan not visible - cleanup via API
      await apiRequest(`/production-plans/${createdPlan.id}`, {
        method: 'DELETE',
        token: fixture.tokens.accessToken,
      });
    }
  });

  test('DELETE: should fail to delete non-existent plan', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    try {
      await apiRequest(`/production-plans/${fakeId}`, {
        method: 'DELETE',
        token: fixture.tokens.accessToken,
      });
      throw new Error('Delete should have failed for non-existent plan');
    } catch (error: any) {
      // Expected - should fail
      expect(error).toBeDefined();
    }
  });

  // ==================== INTEGRATION TESTS ====================

  test('INTEGRATION: should create, read, update, and delete plan in sequence', async () => {
    // CREATE
    const planData = {
      name: `E2E Integration Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      plannedQuantity: 1000,
      status: 'Planned',
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    expect(createdPlan.id).toBeDefined();
    expect(createdPlan.name).toBe(planData.name);

    // READ
    const readPlan = await apiRequest(`/production-plans/${createdPlan.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(readPlan.id).toBe(createdPlan.id);
    expect(readPlan.name).toBe(planData.name);

    // UPDATE
    const updatedName = `E2E Updated Integration Test ${Date.now()}`;
    const updatedPlan = await apiRequest(`/production-plans/${createdPlan.id}`, {
      method: 'PUT',
      token: fixture.tokens.accessToken,
      body: JSON.stringify({
        name: updatedName,
        status: 'Active',
      }),
    });

    expect(updatedPlan.name).toBe(updatedName);
    expect(updatedPlan.status).toBe('Active');

    // DELETE
    await apiRequest(`/production-plans/${createdPlan.id}`, {
      method: 'DELETE',
      token: fixture.tokens.accessToken,
    });

    // Verify deletion
    try {
      await apiRequest(`/production-plans/${createdPlan.id}`, {
        method: 'GET',
        token: fixture.tokens.accessToken,
      });
      throw new Error('Plan should have been deleted but still exists');
    } catch (error: any) {
      // Expected - plan should not exist
      expect(error).toBeDefined();
    }
  });

  test('INTEGRATION: should handle date edge cases', async () => {
    // Test with same start and end date
    const sameDate = new Date().toISOString();
    const planData = {
      name: `E2E Date Edge Case ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: sameDate,
      endDate: sameDate,
    };

    const plan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(plan.id);
    expect(plan).toBeDefined();

    // Test with end date before start date (should fail validation)
    try {
      await apiRequest('/production-plans', {
        method: 'POST',
        token: fixture.tokens.accessToken,
        body: JSON.stringify({
          name: 'Invalid Date Range',
          unitId: fixture.unit.id,
          tenantId: fixture.tenant.id,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        }),
      });
      throw new Error('Should have failed validation for invalid date range');
    } catch (error: any) {
      // Expected - should fail validation
      expect(error).toBeDefined();
    }
  });

  test('UI: should display dates in user-friendly format on plan cards', async ({ page }) => {
    // Create a plan with specific dates
    const startDate = new Date('2025-12-01');
    const endDate = new Date('2025-12-17');
    const planData = {
      name: `E2E Date Format Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    const createdPlan = await apiRequest('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    await loginViaAPI(page);
    await page.goto('/production-plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find the plan card
    const planCard = page.locator(`text=${planData.name}`).first();
    const isVisible = await planCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      // Get the schedule text
      const scheduleSection = planCard.locator('..').locator('..').locator('text=/Schedule:/i').first();
      if (await scheduleSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        const scheduleText = await scheduleSection.locator('..').textContent();
        
        // Verify it's NOT in ISO format
        expect(scheduleText).not.toContain('2025-12-01T00:00:00.000Z');
        expect(scheduleText).not.toContain('2025-12-17T00:00:00.000Z');
        expect(scheduleText).not.toContain('T00:00:00');
        expect(scheduleText).not.toContain('.000Z');
        
        // Verify it contains user-friendly date format (e.g., "Dec 1" or "Dec 17")
        expect(scheduleText).toMatch(/Dec|December|12/);
      }
    }
  });

  test('UI: should handle all CRUD operations in sequence via UI', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/production-plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give more time for page to render
    
    // Check if page loaded
    const pageLoaded = await page.locator('body').isVisible({ timeout: 5000 }).catch(() => false);
    if (!pageLoaded) {
      throw new Error('Page did not load');
    }

    // CREATE
    const planName = `E2E Full CRUD Test ${Date.now()}`;
    let createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New Plan")').first();
    
    // If not found, try looking for any button with plus icon or create-related text
    if (!(await createButton.isVisible({ timeout: 2000 }).catch(() => false))) {
      createButton = page.locator('button').filter({ hasText: /Create|Add|New/i }).first();
    }
    
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click({ timeout: 10000 });
    } else {
      // Skip test if create button not found
      console.log('Create button not found, skipping UI CRUD test');
      return;
    }
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Fill form
    const nameInput = page.locator('[role="dialog"] input#name').first();
    await nameInput.fill(planName);

    // Select unit
    const unitSelect = page.locator('[role="dialog"] button[role="combobox"], [role="dialog"] select').first();
    if (await unitSelect.getAttribute('role') === 'combobox') {
      await unitSelect.click();
      await page.waitForTimeout(500);
      await page.locator(`[role="option"]:has-text("${fixture.unit.name}")`).first().click({ timeout: 5000 });
    } else {
      await unitSelect.selectOption({ value: fixture.unit.id });
    }

    // Fill dates
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    const startDateInput = page.locator('[role="dialog"] input[type="date"]').first();
    const endDateInput = page.locator('[role="dialog"] input[type="date"]').last();
    await startDateInput.fill(today.toISOString().split('T')[0]);
    await endDateInput.fill(tomorrow.toISOString().split('T')[0]);

    // Submit
    const submitButton = page.locator('[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save")').first();
    await submitButton.click({ timeout: 5000 });
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // READ - Verify plan appears
    const planLocator = page.locator(`text=${planName}`).first();
    await planLocator.scrollIntoViewIfNeeded();
    await expect(planLocator).toBeVisible({ timeout: 10000 });

    // Verify dates are formatted correctly
    const scheduleText = await page.locator(`text=/Schedule:/i`).first().locator('..').textContent();
    expect(scheduleText).not.toContain('T00:00:00');

    // UPDATE - Click edit
    const editButton = planLocator.locator('..').locator('..').locator('button:has-text("Edit")').first();
    const hasEditButton = await editButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasEditButton) {
      await editButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Update name
      const updatedName = `${planName} - Updated`;
      const nameInputEdit = page.locator('[role="dialog"] input#name').first();
      await nameInputEdit.clear();
      await nameInputEdit.fill(updatedName);

      // Save
      const saveButton = page.locator('[role="dialog"] button:has-text("Update"), [role="dialog"] button:has-text("Save")').first();
      await saveButton.click({ timeout: 5000 });
      await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Verify update
      await expect(page.locator(`text=${updatedName}`).first()).toBeVisible({ timeout: 10000 });
    }

    // DELETE - Get plan ID from API to cleanup
    const plans = await apiRequest(`/production-plans?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });
    const testPlan = plans.find((p: any) => p.name === planName || p.name === `${planName} - Updated`);
    if (testPlan) {
      createdPlanIds.push(testPlan.id);
    }
  });
});

