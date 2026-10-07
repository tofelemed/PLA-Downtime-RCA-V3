export interface JwtPayload {
  sub: string;  // user ID
  email: string;
  role: string;
  tenantId?: string;
  organizationId?: string;
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

