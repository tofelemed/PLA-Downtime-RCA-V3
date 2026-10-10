export interface JwtPayload {
  sub: string;  // user ID
  email: string;
  role: string;
  tenantId?: string;
  organizationId?: string;
  /** `access` on access tokens (plan 3.11); refresh tokens never reach the JWT strategy */
  typ?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  organizationId?: string;
}

