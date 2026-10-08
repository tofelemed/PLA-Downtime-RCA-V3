import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { Unit } from '../../unit/unit.entity';

export type ScopeParamName = 'tenantId' | 'siteId' | 'unitId';

/**
 * Answers "is this id inside the caller's scope?" for `ScopeGuard`.
 *
 * A tenant scope covers every unit of that tenant, so a unit id is checked against `units.tenant_id`;
 * an explicit unit scope matches by id. Sites arrive with the plant hierarchy (1.x) and are matched
 * by id only until then.
 */
@Injectable()
export class ScopeMembershipService {
  constructor(
    @InjectRepository(Unit)
    private readonly units: Repository<Unit>,
  ) {}

  async isWithinScope(
    context: RequestContext,
    param: ScopeParamName,
    id: string,
  ): Promise<boolean> {
    if (context.isSuperAdmin) {
      return true;
    }
    if (param === 'tenantId') {
      return (
        context.tenantId === id ||
        context.scopes.some((scope) => scope.tenantId === id)
      );
    }
    if (param === 'siteId') {
      return context.scopes.some(
        (scope) =>
          (scope.kind === 'site' && scope.id === id) ||
          (scope.kind === 'tenant' && scope.tenantId === context.tenantId),
      );
    }
    return this.isUnitWithinScope(context, id);
  }

  private async isUnitWithinScope(
    context: RequestContext,
    unitId: string,
  ): Promise<boolean> {
    if (
      context.scopes.some(
        (scope) => scope.kind === 'unit' && scope.id === unitId,
      )
    ) {
      return true;
    }
    if (!context.tenantId) {
      return false;
    }
    const tenantWide =
      context.scopes.length === 0 ||
      context.scopes.some(
        (scope) =>
          scope.kind === 'tenant' && scope.tenantId === context.tenantId,
      );
    if (!tenantWide) {
      return false;
    }
    return (
      (await this.units.countBy({ id: unitId, tenantId: context.tenantId })) > 0
    );
  }
}
