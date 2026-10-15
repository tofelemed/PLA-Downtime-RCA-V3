import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { VersionState } from '../domain/profiles/profile.types';
import {
  invalid,
  invalidReference,
  notFound,
} from '../profiles/profile-errors';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { validityOf } from '../profiles/profiles.service';
import {
  approveVersion,
  nextVersion,
  retireVersion,
} from '../profiles/versioning';
import { keysetPage } from '../v2/common/keyset-page';
import {
  DemandStatus,
  DemandStatusValue,
} from './entities/demand-status.entity';
import {
  recordValuationChanges,
  RevaluationRequested,
} from './valuation-events';

export interface NewDemandStatus {
  productId: string;
  status: DemandStatusValue;
  evidence: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface DemandStatusFilter {
  productId?: string;
  state?: VersionState;
  cursor?: string;
  limit: number;
}

export interface DemandStatusTransition {
  status: DemandStatus;
  revaluation: RevaluationRequested | null;
}

const WHAT = 'demand status';

/**
 * SME V3 (14 Oct 2026): whether a product was sold out (demand constrained) over a period, with the
 * evidence that substantiates it. Finance maintainers draft, finance approvers (never the author) approve
 * or retire; approved versions of a product never overlap (`supersede` closes the predecessor). A status
 * applies to every unit making the product, so writes need a tenant-wide grant; an approval or the
 * retirement of an approved status queues the revaluation of the periods it covers (SME V7).
 */
@Injectable()
export class DemandStatusesService {
  constructor(
    @InjectRepository(DemandStatus)
    private readonly statuses: Repository<DemandStatus>,
  ) {}

  async create(
    context: RequestContext,
    input: NewDemandStatus,
  ): Promise<DemandStatus> {
    const tenantId = requireTenantId(context);
    assertTenantWideWriter(context, tenantId);
    const evidence = input.evidence.trim();
    if (!evidence)
      throw invalid('EVIDENCE_REQUIRED', 'a demand status names its evidence');
    const validity = validityOf(input);
    return this.statuses.manager.transaction(async (manager) => {
      await assertProduct(manager, tenantId, input.productId);
      const key = { tenantId, productId: input.productId };
      const version = await nextVersion(manager, DemandStatus, key);
      return manager.save(
        manager.create(DemandStatus, {
          ...key,
          status: input.status,
          evidence,
          effectiveFrom: validity.from,
          effectiveTo: validity.to,
          version,
          state: 'draft',
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** Versions of the tenant (keyset on effectiveFrom, id), optionally of one product and state. */
  list(
    context: RequestContext,
    query: DemandStatusFilter,
  ): Promise<{ items: DemandStatus[]; nextCursor: string | null }> {
    const qb = scopedQuery(this.statuses, 'd', { context });
    if (query.productId)
      qb.andWhere('d.productId = :productId', { productId: query.productId });
    if (query.state) qb.andWhere('d.state = :state', { state: query.state });
    return keysetPage(qb, {
      alias: 'd',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async get(context: RequestContext, id: string): Promise<DemandStatus> {
    const found = await scopedQuery(this.statuses, 'd', { context })
      .andWhere('d.id = :id', { id })
      .getOne();
    if (!found) throw notFound(WHAT);
    return found;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<DemandStatusTransition> {
    const row = await this.get(context, id);
    assertTenantWideWriter(context, row.tenantId);
    return this.statuses.manager.transaction(async (manager) => {
      const { approved } = await approveVersion(
        manager,
        DemandStatus,
        {
          id: row.id,
          key: { tenantId: row.tenantId, productId: row.productId },
          supersede,
          actorId: context.userId,
        },
        WHAT,
      );
      const revaluation = await recordValuationChanges(manager, [
        {
          tenantId: approved.tenantId,
          subject: 'demand_status',
          change: 'approved',
          row: approved,
        },
      ]);
      return { status: approved, revaluation };
    });
  }

  async retire(
    context: RequestContext,
    id: string,
  ): Promise<DemandStatusTransition> {
    const row = await this.get(context, id);
    assertTenantWideWriter(context, row.tenantId);
    const wasApproved = row.state === 'approved';
    return this.statuses.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        DemandStatus,
        { id: row.id, actorId: context.userId },
        WHAT,
      );
      const changes = wasApproved
        ? [
            {
              tenantId: retired.tenantId,
              subject: 'demand_status' as const,
              change: 'retired' as const,
              row: retired,
            },
          ]
        : [];
      const revaluation = await recordValuationChanges(manager, changes);
      return { status: retired, revaluation };
    });
  }
}

/** The product must be one of the plant's: 422 INVALID_REFERENCE otherwise. */
async function assertProduct(
  manager: EntityManager,
  tenantId: string,
  productId: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "products" WHERE "id" = $1 AND "tenant_id" = $2::uuid`,
    [productId, tenantId.toLowerCase()],
  );
  if (rows.length === 0) throw invalidReference('productId', 'product');
}
