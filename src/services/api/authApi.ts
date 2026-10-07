import { httpClient } from './httpClient';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
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

export interface RefreshResponse extends LoginResponse {}

interface ValidateTokenResponse {
  valid: boolean;
  payload: Record<string, unknown>;
}

export const authApi = {
  login(payload: LoginRequest) {
    return httpClient.request<LoginResponse>('auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
  },

  refreshToken(refreshToken: string) {
    return httpClient.request<RefreshResponse>('auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    });
  },

  logout() {
    // Logout is now public (no auth required) - just clear local token
    return httpClient.request<{ message: string }>('auth/logout', {
      method: 'POST',
      skipAuth: true, // Logout doesn't require authentication
    });
  },

  getProfile() {
    return httpClient.request<{
      userId: string;
      email: string;
      role: string;
      tenantId?: string;
      organizationId?: string;
    }>('auth/profile', {
      method: 'GET',
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


