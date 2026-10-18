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
import { UnitImpactMode } from '../domain/reliability/unit-impact';
import {
  invalid,
  invalidReference,
  notFound,
} from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import { validityOf } from '../profiles/profiles.service';
import {
  approveVersion,
  nextVersion,
  retireVersion,
} from '../profiles/versioning';
import { UnitImpactRule } from './entities/unit-impact-rule.entity';

/** Outbox message: an approved rule changed; the stops of its asset in its validity are resolved again. */
export const UNIT_IMPACT_RULE_CHANGED = 'UnitImpactRuleChanged';

export interface NewUnitImpactRule {
  unitId: string;
  assetId: string;
  mode: UnitImpactMode;
  fraction?: string | null;
  standbyAssetId?: string | null;
  takeoverSeconds?: number;
  reason: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

const WHAT = 'unit impact rule';

/** Pilot default of the takeover window (engineering default, DECISIONS 15 Oct 2026). */
export const DEFAULT_TAKEOVER_SECONDS = 60;

const keyOf = (row: { unitId: string; assetId: string }) => ({
  unitId: row.unitId,
  assetId: row.assetId,
});

/** 422 INVALID_FRACTION: `fractional` needs 0 < fraction ≤ 1; the other modes carry none. */
function fractionOf(input: NewUnitImpactRule): string | null {
  const value = toDec(input.fraction ?? null);
  if (input.mode !== 'fractional') {
    if (value !== null)
      throw invalid(
        'INVALID_FRACTION',
        'only a fractional rule has a fraction',
      );
    return null;
  }
  if (value === null || value.lte(0) || value.gt(1))
    throw invalid(
      'INVALID_FRACTION',
      'a fractional rule needs 0 < fraction ≤ 1',
    );
  return value.toString();
}

/**
 * Unit impact rules (plan 1.10 step 4, SME Q5 + D9): drafted by master data, approved by another user
 * (maker-checker, 403 SEPARATION_OF_DUTIES), never overlapping an approved version of the same (unit,
 * asset) unless superseding it. Approving or retiring one queues the re-resolution of the asset's stops
 * over its validity (`UnitImpactRuleChanged`); the changed events recalculate their periods.
 */
@Injectable()
export class UnitImpactRulesService {
  constructor(
    @InjectRepository(UnitImpactRule)
    private readonly rules: Repository<UnitImpactRule>,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewUnitImpactRule,
  ): Promise<UnitImpactRule> {
    const tenantId = requireTenantId(context);
    await this.references.assertUnit(context, input.unitId);
    await this.assertAsset(tenantId, input.assetId, input.unitId);
    if (input.standbyAssetId) {
      if (input.standbyAssetId === input.assetId)
        throw invalid('SAME_ASSET', 'the standby is another asset');
      await this.assertAsset(tenantId, input.standbyAssetId, null);
    }
    const fraction = fractionOf(input);
    const validity = validityOf(input);
    return this.rules.manager.transaction(async (manager) => {
      const key = keyOf(input);
      const version = await nextVersion(manager, UnitImpactRule, key);
      return manager.save(
        manager.create(UnitImpactRule, {
          tenantId,
          ...key,
          mode: input.mode,
          fraction,
          standbyAssetId: input.standbyAssetId ?? null,
          takeoverSeconds: input.takeoverSeconds ?? DEFAULT_TAKEOVER_SECONDS,
          reason: input.reason.trim(),
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

  async get(context: RequestContext, id: string): Promise<UnitImpactRule> {
    const row = await scopedQuery(this.rules, 'r', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!row) throw notFound('Unit impact rule');
    return row;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<UnitImpactRule> {
    const row = await this.get(context, id);
    return this.rules.manager.transaction(async (manager) => {
      const result = await approveVersion(
        manager,
        UnitImpactRule,
        {
          id,
          key: keyOf(row),
          supersede,
          actorId: context.userId,
          isSuperAdmin: context.isSuperAdmin,
        },
        WHAT,
      );
      // a superseded predecessor now ends where the approved version starts: the same window changes
      await changed(manager, result.approved, result.approved.effectiveFrom);
      return result.approved;
    });
  }

  async retire(context: RequestContext, id: string): Promise<UnitImpactRule> {
    const row = await this.get(context, id);
    return this.rules.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        UnitImpactRule,
        { id: row.id, actorId: context.userId },
        WHAT,
      );
      if (row.state === 'approved')
        await changed(manager, retired, retired.effectiveFrom);
      return retired;
    });
  }

  private async assertAsset(
    tenantId: string,
    assetId: string,
    unitId: string | null,
  ): Promise<void> {
    const rows = await this.rules.manager.query<Array<{ unit_id: string }>>(
      `SELECT "unit_id" FROM "assets" WHERE "id" = $1 AND "tenant_id" = $2`,
      [assetId, tenantId],
    );
    const field = unitId ? 'assetId' : 'standbyAssetId';
    if (rows.length === 0) throw invalidReference(field, 'asset');
    if (unitId && rows[0].unit_id !== unitId)
      throw invalid('ASSET_NOT_IN_UNIT', 'the asset belongs to another unit');
  }
}

/** The rule's (unit, asset) over its validity is resolved again by the stop-events consumer. */
async function changed(
  manager: EntityManager,
  row: UnitImpactRule,
  from: Date,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: row.tenantId,
      aggregateType: 'unit_impact_rule',
      aggregateId: row.id,
      type: UNIT_IMPACT_RULE_CHANGED,
      version: row.rowVersion,
      payload: {
        unitId: row.unitId,
        assetId: row.assetId,
        state: row.state,
        effectiveFrom: from.toISOString(),
        effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
      },
    },
  ]);
}
