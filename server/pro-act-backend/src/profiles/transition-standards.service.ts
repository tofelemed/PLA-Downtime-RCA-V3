import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { scopedQuery } from '../common/query/scoped-query';
import { toDec } from '../domain/actuals/decimal';
import { GradeTransitionStandard } from './entities/transition-standard.entity';
import { invalid, notFound } from './profile-errors';
import { BaselineChange, PROFILE_BASELINE_CHANGED } from './profile-events';
import { ProfileReferences } from './profile-references';
import { validityOf } from './profiles.service';
import { approveVersion, nextVersion, retireVersion } from './versioning';

export interface NewTransitionStandard {
  unitId: string;
  fromProductId: string;
  toProductId: string;
  referenceSeconds: string;
  referenceOffgradeQty?: string | null;
  offgradeUom?: string | null;
  sampleCount?: number | null;
  evidence?: string | null;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

const WHAT = 'transition standard';

const keyOf = (row: {
  unitId: string;
  fromProductId: string;
  toProductId: string;
}) => ({
  unitId: row.unitId,
  fromProductId: row.fromProductId,
  toProductId: row.toProductId,
});

/** 422 unless the reference is a positive duration and the off-grade a quantity ≥ 0 with its unit. */
function assertQuantities(input: NewTransitionStandard): void {
  const seconds = toDec(input.referenceSeconds);
  if (seconds === null || seconds.lte(0)) {
    throw invalid('INVALID_REFERENCE_SECONDS', 'referenceSeconds must be > 0');
  }
  if (input.referenceOffgradeQty == null) return;
  const offGrade = toDec(input.referenceOffgradeQty);
  if (offGrade === null || offGrade.isNegative()) {
    throw invalid('INVALID_OFFGRADE', 'referenceOffgradeQty must be ≥ 0');
  }
  if (!input.offgradeUom?.trim()) {
    throw invalid('UOM_REQUIRED', 'offgradeUom is required with referenceOffgradeQty');
  }
}

/**
 * Approved-baseline message (LA-03) for a transition standard: the open periods of its unit over its
 * interval are recalculated, approved ones get a change proposal.
 */
async function recordStandardChanges(
  manager: EntityManager,
  changes: ReadonlyArray<{ row: GradeTransitionStandard; change: BaselineChange }>,
): Promise<void> {
  await enqueueOutbox(
    manager,
    changes.map(({ row, change }) => ({
      tenantId: row.tenantId,
      aggregateType: 'transition_standard',
      aggregateId: row.id,
      type: PROFILE_BASELINE_CHANGED,
      version: row.rowVersion,
      payload: {
        change,
        id: row.id,
        version: row.version,
        subject: 'transition_standard',
        unitId: row.unitId,
        fromProductId: row.fromProductId,
        toProductId: row.toProductId,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
      },
    })),
  );
}

/**
 * The grade-transition matrix (LA-08, SME Q9 / E1): one versioned entry per unit and directional
 * product change, drafted by master data and approved by another user (maker-checker, 403
 * SEPARATION_OF_DUTIES), never overlapping an approved version unless superseding it.
 */
@Injectable()
export class TransitionStandardsService {
  constructor(
    @InjectRepository(GradeTransitionStandard)
    private readonly standards: Repository<GradeTransitionStandard>,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewTransitionStandard,
  ): Promise<GradeTransitionStandard> {
    await this.references.assertUnit(context, input.unitId);
    await this.references.assertProduct(context, input.fromProductId, 'fromProductId');
    await this.references.assertProduct(context, input.toProductId, 'toProductId');
    if (input.fromProductId === input.toProductId) {
      throw invalid('SAME_PRODUCT', 'fromProductId and toProductId must differ');
    }
    assertQuantities(input);
    const validity = validityOf(input);
    return this.standards.manager.transaction(async (manager) => {
      const key = keyOf(input);
      const version = await nextVersion(manager, GradeTransitionStandard, key);
      return manager.save(
        manager.create(GradeTransitionStandard, {
          tenantId: requireTenantId(context),
          ...key,
          referenceSeconds: input.referenceSeconds,
          referenceOffgradeQty: input.referenceOffgradeQty ?? null,
          offgradeUom: input.offgradeUom?.trim() || null,
          sampleCount: input.sampleCount ?? null,
          evidence: input.evidence ?? null,
          notes: input.notes ?? null,
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

  async get(context: RequestContext, id: string): Promise<GradeTransitionStandard> {
    const row = await scopedQuery(this.standards, 's', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!row) throw notFound('Transition standard');
    return row;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<GradeTransitionStandard> {
    const row = await this.get(context, id);
    return this.standards.manager.transaction(async (manager) => {
      const result = await approveVersion(
        manager,
        GradeTransitionStandard,
        { id, key: keyOf(row), supersede, actorId: context.userId },
        WHAT,
      );
      await recordStandardChanges(manager, [
        { row: result.approved, change: 'approved' },
        ...(result.superseded
          ? [{ row: result.superseded, change: 'superseded' as const }]
          : []),
      ]);
      return result.approved;
    });
  }

  async retire(context: RequestContext, id: string): Promise<GradeTransitionStandard> {
    const row = await this.get(context, id);
    return this.standards.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        GradeTransitionStandard,
        { id: row.id, actorId: context.userId },
        WHAT,
      );
      if (row.state === 'approved') {
        await recordStandardChanges(manager, [{ row: retired, change: 'retired' }]);
      }
      return retired;
    });
  }
}
