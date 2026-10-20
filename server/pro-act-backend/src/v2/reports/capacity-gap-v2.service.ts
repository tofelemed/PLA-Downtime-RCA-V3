import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { ProfileResolutionService } from '../../profiles/profile-resolution.service';
import {
  CAPACITY_GAP_LIMIT_MAX,
  CapacityGapQueryDto,
} from './capacity-gap-v2.dto';
import {
  CapacityGapReportView,
  toCapacityGapRow,
} from './capacity-gap-v2.view';
import { namedReportUnits } from './report-scope';

/**
 * Capacity gap report (plan 1.2, D-T1): per approved profile (unit, product, mode) in force at `at`, the
 * approved rate of each kind in force then, side by side, with the gaps and ratios of the domain. Two
 * queries per page (profiles, then their rates), at most `limit` rows ordered by unit, product and mode.
 */
@Injectable()
export class CapacityGapReportV2Service {
  constructor(
    @InjectRepository(ProductionProfile)
    private readonly profiles: Repository<ProductionProfile>,
    private readonly resolution: ProfileResolutionService,
  ) {}

  async report(
    context: RequestContext,
    query: CapacityGapQueryDto,
  ): Promise<CapacityGapReportView> {
    const at = query.at ? new Date(query.at) : new Date();
    const limit = query.limit ?? CAPACITY_GAP_LIMIT_MAX;
    const rows = await this.profilesInForce(context, query, at, limit);
    const page = rows.slice(0, limit);
    const rates = await this.resolution.ratesInForce(
      requireTenantId(context),
      page.map((profile) => profile.id),
      at,
    );
    const byProfile = new Map<string, UnitProductRate[]>();
    for (const rate of rates) {
      byProfile.set(rate.profileId, [
        ...(byProfile.get(rate.profileId) ?? []),
        rate,
      ]);
    }
    return {
      at: at.toISOString(),
      items: page.map((profile) =>
        toCapacityGapRow(profile, byProfile.get(profile.id) ?? []),
      ),
      limit,
      truncated: rows.length > limit,
      asOf: new Date().toISOString(),
    };
  }

  /** Approved profiles in force at `at` of the caller's units (scopedQuery), `limit + 1` rows. */
  private async profilesInForce(
    context: RequestContext,
    query: CapacityGapQueryDto,
    at: Date,
    limit: number,
  ): Promise<ProductionProfile[]> {
    const unitIds = await namedReportUnits(
      this.profiles.manager,
      context,
      query.unitIds,
    );
    const qb = scopedQuery(this.profiles, 'p', {
      context,
      unitProperty: 'unitId',
    })
      .innerJoin('p.unit', 'u')
      .innerJoin('p.product', 'pr')
      .addSelect(['u.id', 'u.name', 'pr.id', 'pr.name'])
      .andWhere(`p.state = 'approved'`)
      .andWhere(
        'p.effectiveFrom <= :at AND (p.effectiveTo IS NULL OR p.effectiveTo > :at)',
        { at },
      );
    if (unitIds) qb.andWhere('p.unitId IN (:...unitIds)', { unitIds });
    if (query.productIds?.length) {
      qb.andWhere('p.productId IN (:...productIds)', {
        productIds: [...new Set(query.productIds)],
      });
    }
    return qb
      .orderBy('u.name')
      .addOrderBy('pr.name')
      .addOrderBy('p.operatingMode')
      .addOrderBy('p.id')
      .limit(limit + 1)
      .getMany();
  }
}
