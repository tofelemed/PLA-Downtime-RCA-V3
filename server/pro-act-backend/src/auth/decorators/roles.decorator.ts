import { SetMetadata } from '@nestjs/common';

export type UserRole = 'SuperAdmin' | 'OrgAdmin' | 'TenantAdmin' | 'Manager' | 'Analyst' | 'Engineer' | 'Operator';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

