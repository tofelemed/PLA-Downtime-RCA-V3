import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  delegationRefusal,
  GrantRef,
  holdsForScope,
} from '../../../auth/delegations/delegation-rules';
import { RoleDelegation } from '../../../auth/delegations/role-delegation.entity';
import { satisfiesRole } from '../../../auth/roles/role-model';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { scopedQuery } from '../../../common/query/scoped-query';
import { keysetPage } from '../../common/keyset-page';
import { listResponse, ListResponse } from '../../common/response';
import {
  CreateRoleDelegationDto,
  RevokeRoleDelegationDto,
  RoleDelegationsListQueryDto,
} from './role-delegations-v2.dto';
import {
  RoleDelegationV2View,
  toRoleDelegationView,
} from './role-delegation-v2.view';

const ADMINS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'];

const invalid = (code: string, message: string) =>
  new UnprocessableEntityException({ code, message });

const REFUSAL_TEXT: Readonly<Record<string, string>> = {
  SELF_DELEGATION: 'a role is delegated to someone else',
  INVALID_INTERVAL: 'validUntil must be after validFrom',
  TOO_LONG: 'a delegation lasts at most 90 days',
  ALREADY_ENDED: 'the delegation would already be over',
};

/** The site of a unit / the tenant of a site, to check the scope belongs to the plant. */
async function siteOfScope(
  manager: EntityManager,
  tenantId: string,
  body: CreateRoleDelegationDto,
): Promise<string | null> {
  if (body.scopeKind === 'tenant') {
    if (body.scopeId !== tenantId)
      throw invalid('INVALID_SCOPE', 'scopeId must be the acting plant');
    return null;
  }
  const table = body.scopeKind === 'site' ? 'sites' : 'units';
  const column = body.scopeKind === 'site' ? '"id"' : '"site_id"';
  const [row]: Array<{ site: string | null }> = await manager.query(
    `SELECT ${column}::text AS "site" FROM "${table}" WHERE "id" = $1 AND "tenant_id" = $2`,
    [body.scopeId, tenantId],
  );
  if (!row)
    throw invalid(
      'INVALID_SCOPE',
      `scopeId is not a ${body.scopeKind} of the acting plant`,
    );
  return body.scopeKind === 'unit' ? row.site : null;
}

/**
 * SME R1 / R6 delegates of the acting plant: list, create and revoke time-boxed delegations of an approval
 * role. A plant administrator records them for anyone, a role holder for themselves; the delegator must hold
 * the role on the scope (own grant or legacy home-plant role, never a delegated one), the delegate must be an
 * active member of the plant and not the delegator; at most 90 days. Audited by the global interceptor;
 * rows are never deleted (revocation is recorded).
 */
@Injectable()
export class RoleDelegationsV2Service {
  constructor(
    @InjectRepository(RoleDelegation)
    private readonly delegations: Repository<RoleDelegation>,
  ) {}

  async list(
    context: RequestContext,
    query: RoleDelegationsListQueryDto,
  ): Promise<ListResponse<RoleDelegationV2View>> {
    const tenantId = requireTenantId(context);
    const now = new Date();
    const qb = scopedQuery(this.delegations, 'd', { context });
    if (query.state === 'in_force') {
      qb.andWhere(
        'd.revokedAt IS NULL AND d.validFrom <= :now AND d.validUntil > :now',
        { now },
      );
    }
    const page = await keysetPage(qb, {
      alias: 'd',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const names = await this.namesOf(page.items);
    return listResponse(
      page.items.map((d) => toRoleDelegationView(d, names, now)),
      page.nextCursor,
      { tenantId },
    );
  }

  create(
    context: RequestContext,
    body: CreateRoleDelegationDto,
  ): Promise<RoleDelegationV2View> {
    const tenantId = requireTenantId(context);
    const actor = context.userId as string;
    const isAdmin = ADMINS.some((role) => satisfiesRole(context.roles, role));
    if (!isAdmin && body.delegatorId !== actor) {
      throw new ForbiddenException({
        code: 'DELEGATION_NOT_ALLOWED',
        message:
          'you delegate your own approval role; a plant administrator records it for others',
      });
    }
    const now = new Date();
    const window = {
      validFrom: new Date(body.validFrom),
      validUntil: new Date(body.validUntil),
    };
    const refusal = delegationRefusal({ ...body, ...window, now });
    if (refusal) throw invalid(refusal, REFUSAL_TEXT[refusal]);
    return this.delegations.manager.transaction(async (manager) => {
      const siteOfUnit = await siteOfScope(manager, tenantId, body);
      await this.assertDelegatorHolds(manager, tenantId, {
        ...body,
        siteOfUnit,
      });
      await this.assertDelegateMember(manager, tenantId, body.delegateId);
      const saved = await manager.save(
        manager.create(RoleDelegation, {
          ...body,
          ...window,
          tenantId,
          reason: body.reason.trim(),
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
          createdBy: actor,
          updatedBy: actor,
        }),
      );
      return toRoleDelegationView(
        saved,
        await this.namesOf([saved], manager),
        now,
      );
    });
  }

  async revoke(
    context: RequestContext,
    id: string,
    body: RevokeRoleDelegationDto,
  ): Promise<RoleDelegationV2View> {
    const actor = context.userId as string;
    const found = await scopedQuery(this.delegations, 'd', { context })
      .andWhere('d.id = :id', { id })
      .getOne();
    if (!found)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    const isAdmin = ADMINS.some((role) => satisfiesRole(context.roles, role));
    if (!isAdmin && actor !== found.delegatorId && actor !== found.delegateId) {
      throw new ForbiddenException({
        code: 'DELEGATION_NOT_ALLOWED',
        message:
          'the delegator, the delegate or a plant administrator revokes a delegation',
      });
    }
    const now = new Date();
    if (found.revokedAt || found.validUntil.getTime() <= now.getTime()) {
      throw new ConflictException({
        code: 'DELEGATION_OVER',
        message: 'the delegation is already revoked or over',
      });
    }
    await this.delegations.update(
      { id: found.id, rowVersion: found.rowVersion },
      {
        revokedAt: now,
        revokedBy: actor,
        revokeReason: body.reason.trim(),
        updatedBy: actor,
      },
    );
    const saved = await this.delegations.findOneByOrFail({ id: found.id });
    return toRoleDelegationView(saved, await this.namesOf([saved]), now);
  }

  /** 422 DELEGATOR_LACKS_ROLE unless the delegator holds the role on the scope on their own. */
  private async assertDelegatorHolds(
    manager: EntityManager,
    tenantId: string,
    target: CreateRoleDelegationDto & { siteOfUnit: string | null },
  ): Promise<void> {
    const [user]: Array<{
      role: string | null;
      tenant_id: string | null;
      active: boolean;
    }> = await manager.query(
      `SELECT "role", "tenant_id"::text AS "tenant_id", "is_active" IS DISTINCT FROM false AS "active" FROM "users" WHERE "id" = $1`,
      [target.delegatorId],
    );
    const grants: GrantRef[] = await manager.query(
      `SELECT "tenant_id"::text AS "tenantId", "role", "scope_kind" AS "kind", "scope_id"::text AS "id"
         FROM "user_scopes" WHERE "user_id" = $1 AND "tenant_id" = $2`,
      [target.delegatorId, tenantId],
    );
    const scope = {
      tenantId,
      role: target.role,
      kind: target.scopeKind,
      id: target.scopeId,
      siteOfUnit: target.siteOfUnit,
    };
    if (
      !user?.active ||
      !holdsForScope(
        grants,
        { role: user.role, tenantId: user.tenant_id },
        scope,
      )
    ) {
      throw invalid(
        'DELEGATOR_LACKS_ROLE',
        'the delegator does not hold this role on this scope',
      );
    }
  }

  /** 422 DELEGATE_NOT_MEMBER unless the delegate is an active member of the plant. */
  private async assertDelegateMember(
    manager: EntityManager,
    tenantId: string,
    delegateId: string,
  ): Promise<void> {
    const [row]: Array<{ ok: boolean }> = await manager.query(
      `SELECT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = $1 AND u."is_active" IS DISTINCT FROM false
                       AND (u."tenant_id" = $2 OR EXISTS (SELECT 1 FROM "user_scopes" s
                                                          WHERE s."user_id" = u."id" AND s."tenant_id" = $2))) AS "ok"`,
      [delegateId, tenantId],
    );
    if (!row?.ok)
      throw invalid(
        'DELEGATE_NOT_MEMBER',
        'the delegate is not an active member of this plant',
      );
  }

  private async namesOf(
    rows: readonly RoleDelegation[],
    manager: EntityManager = this.delegations.manager,
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(rows.flatMap((d) => [d.delegatorId, d.delegateId])),
    ];
    if (ids.length === 0) return new Map();
    const users: Array<{ id: string; name: string }> = await manager.query(
      `SELECT "id"::text AS "id", "name" FROM "users" WHERE "id" = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
