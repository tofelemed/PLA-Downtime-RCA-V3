import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OrganizationService } from '../organization/organization.service';
import { TenantService } from '../tenant/tenant.service';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import {
  getRequestContext,
  RequestContext,
} from '../common/context/request-context';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { canGrantRole, mapLegacyRole } from './roles/role-model';
import { UserScopesService } from './scopes/user-scopes.service';
import {
  SessionScope,
  tenantIdsOf,
  toSessionScopes,
} from './session/session-scopes';
import { AuthTokenService, IssuedTokens } from './tokens/auth-token.service';
import { isAccessToken } from './tokens/token-config';

/** The grants the browser needs to derive its effective roles per acting plant (WF05). */
interface SessionGrants {
  homeTenantId: string | null;
  scopes: SessionScope[];
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private organizationService: OrganizationService,
    private tenantService: TenantService,
    private userScopes: UserScopesService,
    private tokens: AuthTokenService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      return user;
    }
    return null;
  }

  /** Signs a short-lived access token and a new refresh family (plan 3.11). */
  async login(user: User) {
    const tokens = await this.tokens.issue(user);
    return this.sessionResponse(user, tokens);
  }

  /** Spends a refresh token (single use, rotated) and returns the next pair. */
  async refreshToken(refreshToken: string) {
    let current: User | undefined;
    const tokens = await this.tokens.rotate(refreshToken, async (id) => {
      current = await this.usersService.findOne(id);
      return current;
    });
    return this.sessionResponse(current as User, tokens);
  }

  /** Revokes the refresh family of the presented token, if any (logout). */
  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
  }

  /**
   * `GET /auth/profile`: the identity of the token plus the grants the browser derives its roles
   * from. `tenantId` is the acting tenant of this request; `homeTenantId` the user's own.
   */
  async profile(current: AuthenticatedUser) {
    const user = await this.usersService.findOne(current.userId);
    const grants = await this.sessionGrants(
      current.userId,
      user?.tenantId ?? current.tenantId ?? null,
    );
    return {
      userId: current.userId,
      email: current.email,
      role: current.role,
      tenantId: current.tenantId,
      organizationId: current.organizationId,
      ...grants,
    };
  }

  private async sessionResponse(user: User, tokens: IssuedTokens) {
    const grants = await this.sessionGrants(user.id, user.tenantId ?? null);
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      token_type: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        tenantId: user.tenantId,
        organizationId: user.organizationId,
        ...grants,
      },
    };
  }

  /** Same source as `RequestContextFactory`: the `user_scopes` rows of the user, never secrets. */
  private async sessionGrants(
    userId: string,
    homeTenantId: string | null,
  ): Promise<SessionGrants> {
    const grants = await this.userScopes.grantsForUser(userId);
    const organizations = await this.tenantService.organizationsOf(
      tenantIdsOf(grants),
    );
    return { homeTenantId, scopes: toSessionScopes(grants, organizations) };
  }

  async validateToken(token: string) {
    let payload: { typ?: unknown };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (!isAccessToken(payload)) throw new UnauthorizedException('Invalid token');
    return payload;
  }

  async register(
    data: Partial<User> & {
      password: string;
      organizationName?: string;
      tenantName?: string;
    },
  ) {
    if (!data.email || !data.password || !data.name || !data.role) {
      throw new BadRequestException('Missing required fields');
    }
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) throw new ConflictException('Email already in use');

    // Authenticated callers (admins) may not grant above their own rank and, unless SuperAdmin,
    // only register into their own tenant; anonymous registration is allowed only when the route
    // is public (AUTH_ALLOW_PUBLIC_REGISTRATION=true).
    const caller = getRequestContext();
    const callerIsAuthenticated = Boolean(caller?.userId);
    if (callerIsAuthenticated) {
      assertCallerMayRegister(caller!, data);
    } else if (process.env.AUTH_ALLOW_PUBLIC_REGISTRATION !== 'true') {
      throw new UnauthorizedException('Registration requires an administrator');
    }

    let organizationId =
      data.organizationId ??
      (callerIsAuthenticated
        ? (caller!.organizationId ?? undefined)
        : undefined);
    let tenantId =
      data.tenantId ??
      (callerIsAuthenticated ? (caller!.tenantId ?? undefined) : undefined);

    // Auto-create organization if name is provided but ID is not
    if (!organizationId && data.organizationName) {
      const orgCode = data.organizationName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .substring(0, 50);
      // Check if organization with this code already exists
      const existingOrg = await this.organizationService.findByCode(orgCode);
      if (existingOrg) {
        organizationId = existingOrg.id;
      } else {
        const newOrg = await this.organizationService.create({
          name: data.organizationName,
          code: orgCode,
          // isActive column doesn't exist in database schema
          // isActive: true,
        });
        organizationId = newOrg.id;
      }
    }

    // Auto-create tenant if name is provided but ID is not
    // Tenant requires organizationId
    if (!tenantId && data.tenantName) {
      if (!organizationId) {
        throw new BadRequestException(
          'Organization ID or name is required to create a tenant',
        );
      }
      const tenantCode = data.tenantName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .substring(0, 50);
      // Check if tenant with this code already exists in this organization
      const existingTenant = await this.tenantService.findByCodeAndOrganization(
        tenantCode,
        organizationId,
      );
      if (existingTenant) {
        tenantId = existingTenant.id;
      } else {
        const newTenant = await this.tenantService.create({
          name: data.tenantName,
          code: tenantCode,
          organizationId: organizationId!,
          // isActive column doesn't exist in database schema
          // isActive: true,
        });
        tenantId = newTenant.id;
      }
    }

    // For SuperAdmin role, allow registration without org/tenant
    // For other roles, require at least organization
    if (data.role !== 'SuperAdmin' && !organizationId) {
      throw new BadRequestException(
        'Organization ID or name is required for non-SuperAdmin users',
      );
    }

    const user = await this.usersService.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      tenantId: tenantId,
      organizationId: organizationId,
      // phone and department columns don't exist in database schema
      // phone: data.phone,
      // department: data.department,
      isActive: data.isActive,
    });
    if (tenantId) {
      await this.userScopes.grantTenantScope(
        user.id,
        tenantId,
        mapLegacyRole(data.role),
        caller?.userId ?? null,
      );
    }
    // Self-registration signs the new user in; an administrator registering someone else must not
    // receive that person's tokens.
    if (callerIsAuthenticated) {
      return { user: publicUser(user) };
    }
    return this.login(user);
  }
}

function assertCallerMayRegister(
  caller: RequestContext,
  data: {
    role?: string;
    tenantId?: string;
    organizationId?: string;
    organizationName?: string;
    tenantName?: string;
  },
): void {
  if (!data.role || !canGrantRole(caller.roles, data.role)) {
    throw new ForbiddenException({
      code: 'ROLE_GRANT_NOT_ALLOWED',
      message: `Cannot grant role ${data.role}`,
    });
  }
  if (caller.isSuperAdmin) {
    return;
  }
  if (data.tenantId && data.tenantId !== caller.tenantId) {
    throw new ForbiddenException({
      code: 'TENANT_NOT_ALLOWED',
      message: 'Users can only be registered into your own tenant',
    });
  }
  if (data.organizationId && data.organizationId !== caller.organizationId) {
    throw new ForbiddenException({
      code: 'ORGANIZATION_NOT_ALLOWED',
      message: 'Users can only be registered into your own organization',
    });
  }
  // Creating organizations or tenants on the fly is a SuperAdmin operation
  if (data.organizationName || data.tenantName) {
    throw new ForbiddenException({
      code: 'ORGANIZATION_CREATE_NOT_ALLOWED',
      message:
        'Only a SuperAdmin can create organizations or tenants during registration',
    });
  }
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    organizationId: user.organizationId,
    isActive: user.isActive,
  };
}
