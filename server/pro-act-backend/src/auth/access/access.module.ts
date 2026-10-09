import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../audit-log/audit-log.entity';
import { Tenant } from '../../tenant/tenant.entity';
import { Unit } from '../../unit/unit.entity';
import { RequestContextFactory } from '../context/request-context.factory';
import { RolesGuard } from '../guards/roles.guard';
import { ScopeGuard } from '../guards/scope.guard';
import { WriteAccessGuard } from '../guards/write-access.guard';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { ScopeMembershipService } from '../scopes/scope-membership.service';
import { UserScope } from '../scopes/user-scope.entity';
import { UserScopesService } from '../scopes/user-scopes.service';

/**
 * Identity resolution and authorization (WF05): request context, user scopes,
 * role/scope guards and the access-denial audit. Global so `JwtStrategy` and the
 * `APP_GUARD` chain can inject these from any module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserScope, Tenant, Unit, AuditLog])],
  providers: [
    UserScopesService,
    ScopeMembershipService,
    AccessDenialAuditService,
    RequestContextFactory,
    RolesGuard,
    ScopeGuard,
    WriteAccessGuard,
  ],
  exports: [
    UserScopesService,
    ScopeMembershipService,
    AccessDenialAuditService,
    RequestContextFactory,
    RolesGuard,
    ScopeGuard,
    WriteAccessGuard,
  ],
})
export class AccessModule {}
