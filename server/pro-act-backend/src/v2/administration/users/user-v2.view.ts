import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../users/user.entity';

/** `GET /v2/users` item: a user without the password hash, with plant and organization names. */
export interface UserV2View {
  id: string;
  name: string;
  email: string;
  /** legacy role (`users.role`); screens show its label, never the token */
  role: string;
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
  updatedAt: string;
  /** whether the caller may edit, deactivate or delete this user (rank and reach rules) */
  manageable: boolean;
}

/** `GET /v2/users/directory` item: what a name resolver or an assignee picker needs. */
export interface UserDirectoryEntry {
  id: string;
  name: string;
  isActive: boolean;
}

/** `GET /v2/users/grantable-roles`: roles the caller may give (at most its own rank). */
export class GrantableRolesView {
  @ApiProperty({ type: [String], description: 'Legacy roles (`users.role`)' })
  roles: string[];

  @ApiProperty({ type: [String], description: 'Scope roles (`user_scopes`)' })
  scopeRoles: string[];
}

export interface PlaceNames {
  tenants: ReadonlyMap<string, string>;
  organizations: ReadonlyMap<string, string>;
}

export function toUserView(
  user: User,
  names: PlaceNames,
  manageable: boolean,
): UserV2View {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    tenantId: user.tenantId ?? null,
    tenantName: user.tenantId
      ? (names.tenants.get(user.tenantId) ?? null)
      : null,
    organizationId: user.organizationId ?? null,
    organizationName: user.organizationId
      ? (names.organizations.get(user.organizationId) ?? null)
      : null,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
    manageable,
  };
}
