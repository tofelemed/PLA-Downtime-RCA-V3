import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../asset/asset.entity';
import { Product } from '../../product/product.entity';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { ProductionPlan } from '../../production-plan/production-plan.entity';
import { ReasonCode } from '../../reason-code/reason-code.entity';
import { Unit } from '../../unit/unit.entity';

export interface EventReferences {
  assetId?: string | null;
  originUnitId?: string | null;
  originAssetId?: string | null;
  reasonCodeId?: string | null;
  planId?: string | null;
  fromProductId?: string | null;
  toProductId?: string | null;
  recoveryOfEventId?: string | null;
}

/**
 * Foreign ids in an event body must belong to the acting tenant (WF05): assets and plans to the
 * event's unit, reason codes to the tenant's own library (plan 1.3, NFR01: shared tenant-less codes are
 * no longer accepted). Answers 422 without saying whether the id exists elsewhere.
 */
@Injectable()
export class EventReferencesValidator {
  constructor(
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    @InjectRepository(ReasonCode)
    private readonly reasons: Repository<ReasonCode>,
    @InjectRepository(ProductionPlan)
    private readonly plans: Repository<ProductionPlan>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
  ) {}

  /** 404 unless the unit belongs to the tenant (no existence leak across tenants). */
  async assertUnitOwned(tenantId: string, unitId: string): Promise<void> {
    if ((await this.units.countBy({ id: unitId, tenantId })) === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Unit not found',
      });
    }
  }

  async assertOwned(
    tenantId: string,
    unitId: string,
    refs: EventReferences,
  ): Promise<void> {
    if (
      refs.assetId &&
      (await this.assets.countBy({ id: refs.assetId, tenantId, unitId })) === 0
    ) {
      throw invalidReference('assetId');
    }
    if (
      refs.planId &&
      (await this.plans.countBy({ id: refs.planId, tenantId, unitId })) === 0
    ) {
      throw invalidReference('planId');
    }
    if (refs.reasonCodeId) {
      await this.assertReasonCodeOwned(tenantId, refs.reasonCodeId);
    }
    await this.assertOriginOwned(tenantId, refs);
    await this.assertGradeLinksOwned(tenantId, unitId, refs);
  }

  /**
   * LA-08 / SME Q10: transition products are the tenant's; the
   * stop a ramp-up recovers from is a downtime event of the same unit.
   */
  private async assertGradeLinksOwned(
    tenantId: string,
    unitId: string,
    refs: EventReferences,
  ): Promise<void> {
    for (const field of ['fromProductId', 'toProductId'] as const) {
      const id = refs[field];
      if (!id) continue;
      if ((await this.products.countBy({ id, tenantId })) === 0)
        throw invalidReference(field);
    }
    if (!refs.recoveryOfEventId) return;
    const stops = await this.events.countBy({
      id: refs.recoveryOfEventId,
      tenantId,
      unitId,
      physicalType: 'downtime',
    });
    if (stops === 0) throw invalidReference('recoveryOfEventId');
  }

  /** SME D3: the origin unit and asset are the tenant's; an origin asset belongs to the origin unit when one is named. */
  private async assertOriginOwned(
    tenantId: string,
    refs: EventReferences,
  ): Promise<void> {
    if (
      refs.originUnitId &&
      (await this.units.countBy({ id: refs.originUnitId, tenantId })) === 0
    ) {
      throw invalidReference('originUnitId');
    }
    if (!refs.originAssetId) return;
    const where = refs.originUnitId
      ? { id: refs.originAssetId, tenantId, unitId: refs.originUnitId }
      : { id: refs.originAssetId, tenantId };
    if ((await this.assets.countBy(where)) === 0) {
      throw invalidReference('originAssetId');
    }
  }

  /** 422 INVALID_REFERENCE unless the reason code is in the tenant's own library. */
  async assertReasonCodeOwned(
    tenantId: string,
    reasonCodeId: string,
  ): Promise<void> {
    if ((await this.reasons.countBy({ id: reasonCodeId, tenantId })) === 0) {
      throw invalidReference('reasonCodeId');
    }
  }
}

function invalidReference(field: string): UnprocessableEntityException {
  const message = `${field} does not refer to a record of this unit or tenant`;
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}
