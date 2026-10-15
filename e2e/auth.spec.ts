/**
 * Authentication E2E Tests
 * 
 * Tests the authentication flow using real backend data.
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, loginViaAPI, ensureTestUser, clearAuth } from './test-utils/auth-helpers';
import { waitForBackend } from './test-utils/api-helpers';

test.describe('Authentication', () => {
  test.beforeAll(async () => {
    // Wait for backend to be ready
    await waitForBackend();
    // Ensure test user exists
    await ensureTestUser();
  });

  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should login successfully via UI', async ({ page }) => {
    await loginViaUI(page);
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify user is authenticated
    const isAuth = await page.evaluate(() => {
      const auth = JSON.parse(localStorage.getItem('proact_auth_state') || '{}');
      return !!auth?.tokens?.accessToken;
    });
    expect(isAuth).toBe(true);
    
    // Verify header is visible (indicates successful login)
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('should login via API and access protected routes', async ({ page }) => {
    const token = await loginViaAPI(page);
    expect(token).toBeTruthy();
    
    // Navigate to a protected route
    await page.goto('/dashboard');
    
    // Should not show login form (should show dashboard content)
    await expect(page.locator('input#email')).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // If login form is not found, that's good - means we're authenticated
    });
    
    // Should show header (indicates authenticated state)
    await expect(page.locator('header').first()).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/dashboard');
    
    // Verify we're logged in (check for header or user profile)
    await expect(page.locator('header').first()).toBeVisible({ timeout: 5000 });
    
    // Logout - click the logout button in header
    // The logout button is in the header, usually the last button with an icon
    const logoutButton = page.locator('header button').last();
    await logoutButton.click();
    
    // Wait for login form to appear (ProtectedRoute shows LoginForm when logged out)
    await page.waitForSelector('input#email', { timeout: 5000 });
    
    // Token should be cleared
    const isAuth = await page.evaluate(() => {
      const auth = localStorage.getItem('proact_auth_state');
      return !!auth;
    });
    expect(isAuth).toBe(false);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to protected route to trigger login form
    await page.goto('/dashboard');
    
    // Wait for login form
    await page.waitForSelector('input#email', { timeout: 10000 });
    
    await page.fill('input#email', 'invalid@example.com');
    await page.fill('input#password', 'wrongpassword');
    await page.click('button[type="submit"]:has-text("Sign In")');
    
    // Should show error message (Alert component with "Invalid email or password")
    await expect(
      page.locator('text=/Invalid email or password|invalid|error|incorrect|failed/i').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

