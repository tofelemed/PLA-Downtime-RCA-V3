import { httpClient } from './httpClient';

/**
 * One `user_scopes` grant of the signed-in user (grouped by tenant and role by the server): the role
 * held in a tenant, tenant-wide unless `unitIds` / `siteIds` limit it.
 */
export interface SessionScope {
  tenantId: string;
  organizationId?: string;
  role: string;
  unitIds?: string[];
  siteIds?: string[];
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  /** legacy role (`users.role`); it only applies in the home tenant (SuperAdmin everywhere, OrgAdmin in its organization) */
  role: string;
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
  /** tenant the legacy role applies in; absent in sessions stored before the server sent it */
  homeTenantId?: string | null;
  /** the scope grants; absent in sessions stored before the server sent them (see `features/auth/effective-roles`) */
  scopes?: SessionScope[];
}

export interface ProfileResponse {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  organizationId?: string;
  homeTenantId?: string | null;
  scopes?: SessionScope[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: AuthenticatedUser;
}

export type RefreshResponse = LoginResponse;

interface ValidateTokenResponse {
  valid: boolean;
  payload: Record<string, unknown>;
}

export const authApi = {
  login(payload: LoginRequest, signal?: AbortSignal) {
    return httpClient.request<LoginResponse>('auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
      signal,
    });
  },

  refreshToken(refreshToken: string, signal?: AbortSignal) {
    return httpClient.request<RefreshResponse>('auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
      signal,
    });
  },

  /** Public; revokes the refresh token's sign-in family on the server (plan 3.11). */
  logout(refreshToken?: string, signal?: AbortSignal) {
    return httpClient.request<{ message: string }>('auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      skipAuth: true,
      signal,
    });
  },

  getProfile(signal?: AbortSignal, tenantId?: string) {
    return httpClient.request<ProfileResponse>('auth/profile', {
      method: 'GET',
      signal,
      headers: tenantId ? { 'X-Tenant-Id': tenantId } : undefined,
    });
  },

  validateToken(token: string) {
    return httpClient.request<ValidateTokenResponse>('auth/validate-token', {
      method: 'POST',
      body: { token },
      skipAuth: true,
    });
  },
};


