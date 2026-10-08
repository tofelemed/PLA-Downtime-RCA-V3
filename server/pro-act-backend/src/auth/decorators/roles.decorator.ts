import { SetMetadata } from '@nestjs/common';
import { LegacyRole, RoleName } from '../roles/role-model';

/** @deprecated use RoleName; kept for the v1 controllers that still import it */
export type UserRole = LegacyRole;

export const ROLES_KEY = 'roles';

/** Legacy roles (`SuperAdmin`, `Engineer`, ...) and scope roles (`manager_approver`, ...) are both accepted. */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
