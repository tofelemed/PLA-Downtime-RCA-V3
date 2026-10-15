/**
 * Authentication Helpers for E2E Tests
 * 
 * Provides utilities for handling authentication in Playwright tests,
 * including login, token management, and session handling.
 */

import { Page } from '@playwright/test';
import { authenticate, registerUser } from './api-helpers';

/**
 * Login via UI and wait for successful authentication
 */
export async function loginViaUI(
  page: Page,
  email: string = 'test@example.com',
  password: string = 'Test123!@#'
): Promise<void> {
  // Navigate to a protected route to trigger login form (or root)
  await page.goto('/dashboard');
  
  // Wait for login form to appear (LoginForm is shown when not authenticated)
  await page.waitForSelector('input#email', { timeout: 10000 });
  
  // Fill in credentials
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  
  // A slow response is distinct from a rejected login; retain the status assertion.
  const response = page.waitForResponse(
    (entry) => entry.url().endsWith('/auth/login') && entry.request().method() === 'POST',
    { timeout: 15000 },
  );
  await page.click('button[type="submit"]:has-text("Sign In")');
  const status = (await response).status();
  if (status !== 200 && status !== 201) throw new Error(`Authentication request failed: HTTP ${status}`);
  
  // Wait for navigation to dashboard after successful login
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  
  // Wait for the authenticated shell; concurrent DB migration tests can delay session hydration.
  await page.getByRole('banner').waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Login via API and set token in localStorage
 */
export async function loginViaAPI(page: Page): Promise<string> {
  try {
    const tokens = await authenticate();
    
    if (!tokens || !tokens.accessToken) {
      throw new Error('Failed to get access token from authentication');
    }
    
    const accessToken = tokens.accessToken;
    
    // Get user data from authenticate response (backend returns user object in login response)
    let userData = {
      email: 'test@example.com',
      role: 'SuperAdmin', // Default fallback - MUST be SuperAdmin for master data access
      id: '',
      name: 'E2E Test User',
      organizationId: null as string | null,
      tenantId: null as string | null,
      isActive: true,
    };
    
    // Backend login response includes user object with role
    if ((tokens as any).user) {
      const user = (tokens as any).user;
      userData = {
        email: user.email || userData.email,
        role: user.role || 'SuperAdmin', // Ensure SuperAdmin role
        id: user.id || user.userId || userData.id,
        name: user.name || userData.name,
        organizationId: user.organizationId || userData.organizationId,
        tenantId: user.tenantId || userData.tenantId,
        isActive: user.isActive !== undefined ? user.isActive : userData.isActive,
      };
    } else {
      // Fallback: Fetch user profile to get role and other user data
      const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4004/api';
      try {
        const profileResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          userData = {
            email: profile.email || userData.email,
            role: profile.role || 'SuperAdmin', // Ensure SuperAdmin role
            id: profile.userId || profile.id || userData.id,
            name: profile.name || userData.name,
            organizationId: profile.organizationId || userData.organizationId,
            tenantId: profile.tenantId || userData.tenantId,
            isActive: true,
          };
        }
      } catch (error) {
        console.warn('Failed to fetch user profile, using defaults with SuperAdmin role:', error);
      }
    }
    
    // Ensure role is SuperAdmin for master data access
    if (userData.role !== 'SuperAdmin' && userData.role !== 'OrgAdmin' && userData.role !== 'TenantAdmin') {
      console.warn(`User role is ${userData.role}, changing to SuperAdmin for test access`);
      userData.role = 'SuperAdmin';
    }
    
    // Navigate to a page first to ensure localStorage is accessible
    await page.goto('/');
    
    // Set token and full user data in localStorage matching StoredAuthState structure
    await page.evaluate(({ token, user, refreshToken }) => {
      const authState = {
        tokens: {
          accessToken: token,
          refreshToken: refreshToken || '',
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
        },
        user: {
          id: user.id || '',
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: true,
          organizationId: user.organizationId || null,
          tenantId: user.tenantId || null,
        },
        organization: null,
        tenant: null,
      };
      localStorage.setItem('proact_auth_state', JSON.stringify(authState));
    }, { 
      token: accessToken, 
      user: userData,
      refreshToken: tokens.refreshToken || ''
    });
    
    // Refresh the page to ensure AuthContext picks up the new auth state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for AuthContext to restore session
    await page.waitForTimeout(1000);
    
    return accessToken;
  } catch (error) {
    console.error('Login via API failed:', error);
    throw error;
  }
}

/**
 * Ensure test user exists (register if needed)
 */
export async function ensureTestUser(
  email: string = 'test@example.com',
  password: string = 'Test123!@#'
): Promise<void> {
  try {
    await authenticate(email, password);
  } catch (error) {
    // User doesn't exist, register them
    await registerUser(email, password, 'E2E Test User', 'SuperAdmin');
  }
}

/**
 * Logout via UI
 */
export async function logoutViaUI(page: Page): Promise<void> {
  // The logout button is in the header, next to the user profile
  // It's a button with LogOut icon (lucide-react icon)
  // Look for button with svg icon or button near user profile section
  const logoutButton = page.locator('button:has(svg), button:has([class*="lucide-log-out"])').filter({ 
    has: page.locator('svg') 
  }).first();
  
  // Alternative: find button in the user profile section
  const userProfileSection = page.locator('header').locator('div:has-text("' + (await page.textContent('header') || '').substring(0, 20) + '")').first();
  
  // Try clicking logout button directly (it's visible in header)
  try {
    // Look for button with LogOut icon in header
    await page.locator('header button:has(svg)').last().click({ timeout: 5000 });
  } catch {
    // Fallback: find any button in header that might be logout
    const headerButtons = page.locator('header button');
    const buttonCount = await headerButtons.count();
    // Logout is usually one of the last buttons in header
    if (buttonCount > 0) {
      await headerButtons.nth(buttonCount - 1).click();
    }
  }
  
  // Wait for login form to appear (ProtectedRoute shows LoginForm when logged out)
  await page.waitForSelector('input#email', { timeout: 5000 });
}

/**
 * Clear authentication state
 */
export async function clearAuth(page: Page): Promise<void> {
  // Navigate to a page first if not already on one
  try {
    if (!page.url() || page.url() === 'about:blank') {
      await page.goto('/');
    }
    await page.evaluate(() => {
      localStorage.removeItem('proact_auth_state');
      sessionStorage.clear();
    });
  } catch (error) {
    // If page isn't ready, just try to clear without navigation
    try {
      await page.evaluate(() => {
        localStorage.removeItem('proact_auth_state');
        sessionStorage.clear();
      });
    } catch {
      // Ignore if still can't access
    }
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const authState = localStorage.getItem('proact_auth_state');
    if (!authState) return false;
    try {
      const auth = JSON.parse(authState);
      return !!auth?.tokens?.accessToken;
    } catch {
      return false;
    }
  });
}

