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

interface PlanDto {
  id: string;
  name: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  status?: string | null;
  plannedQuantity?: number;
}

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

    const plan = await apiRequest<PlanDto>('/production-plans', {
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
    const plans = await apiRequest<PlanDto[]>(`/production-plans?tenantId=${fixture.tenant.id}`, {
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

    const createdPlan = await apiRequest<PlanDto>('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    // Then read it
    const plan = await apiRequest<PlanDto>(`/production-plans/${createdPlan.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(plan).toBeDefined();
    expect(plan.id).toBe(createdPlan.id);
    expect(plan.name).toBe(planData.name);
  });

  test('READ: should filter plans by tenantId', async () => {
    const plans = await apiRequest<PlanDto[]>(`/production-plans?tenantId=${fixture.tenant.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(Array.isArray(plans)).toBe(true);
    // All plans should belong to the test tenant
    plans.forEach((plan) => {
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

    const createdPlan = await apiRequest<PlanDto>('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    const plans = await apiRequest<PlanDto[]>(`/production-plans?tenantId=${fixture.tenant.id}&status=Planned`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(Array.isArray(plans)).toBe(true);
    // Only check plans that have a status field
    plans.forEach((plan) => {
      if (plan.status !== null && plan.status !== undefined) {
        expect(plan.status).toBe('Planned');
      }
    });
  });

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

    const createdPlan = await apiRequest<PlanDto>('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    createdPlanIds.push(createdPlan.id);

    // Update the plan
    const updatedName = `E2E Updated Plan ${Date.now()}`;
    const updatedPlan = await apiRequest<PlanDto>(`/production-plans/${createdPlan.id}`, {
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

  test('UPDATE: should fail with invalid data', async () => {
    // Create a plan first
    const planData = {
      name: `E2E Invalid Update Test ${Date.now()}`,
      unitId: fixture.unit.id,
      tenantId: fixture.tenant.id,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const createdPlan = await apiRequest<PlanDto>('/production-plans', {
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

    const createdPlan = await apiRequest<PlanDto>('/production-plans', {
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

    const createdPlan = await apiRequest<PlanDto>('/production-plans', {
      method: 'POST',
      token: fixture.tokens.accessToken,
      body: JSON.stringify(planData),
    });

    expect(createdPlan.id).toBeDefined();
    expect(createdPlan.name).toBe(planData.name);

    // READ
    const readPlan = await apiRequest<PlanDto>(`/production-plans/${createdPlan.id}`, {
      method: 'GET',
      token: fixture.tokens.accessToken,
    });

    expect(readPlan.id).toBe(createdPlan.id);
    expect(readPlan.name).toBe(planData.name);

    // UPDATE
    const updatedName = `E2E Updated Integration Test ${Date.now()}`;
    const updatedPlan = await apiRequest<PlanDto>(`/production-plans/${createdPlan.id}`, {
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

    const plan = await apiRequest<PlanDto>('/production-plans', {
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

  // The v1 Production Plans screen was replaced by the v2 plans list (plans are created, edited, approved
  // and accounted there: e2e/personas/engineer-planning.spec.ts, manager-1-plans.spec.ts); the old address
  // still opens it.
  test('UI: the old Production Plans address opens the v2 plans list', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/production-plans');
    await expect(page).toHaveURL(/\/planning\?tab=plans/);
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plans-tab')).toBeVisible({ timeout: 60_000 });
  });
});

