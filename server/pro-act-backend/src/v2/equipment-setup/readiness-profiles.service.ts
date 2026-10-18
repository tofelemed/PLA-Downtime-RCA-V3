import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import {
  check,
  coverageCheck,
  EffectiveSpan,
  overlapping,
} from './readiness-checks';
import { ReadinessStore } from './readiness-store';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';

export interface ProfileFacts {
  profiles: ProductionProfile[];
  checks: ReturnType<typeof check>[];
}
@Injectable()
export class ReadinessProfilesService {
  constructor(private readonly store: ReadinessStore) {}
  async read(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ): Promise<ProfileFacts> {
    const ids = ['profile', 'planning_rate', 'sustained_rate'];
    if (!query.productId)
      return {
        profiles: [],
        checks: ids.map((id) =>
          check(
            id,
            'not_checked',
            'Choose a product grade to evaluate the unit/product/mode combination.',
          ),
        ),
      };
    const profiles = await this.store.rows(
      overlapping(
        this.store
          .query(ProductionProfile, context, 'unitId')
          .andWhere(
            'r.unitId = :unitId AND r.productId = :productId AND r.operatingMode = :mode',
            { ...query, mode: query.operatingMode ?? 'normal' },
          ),
        query,
      ),
    );
    const approved = profiles.filter(
      (row) => row.state === 'approved' && row.quantityUom && row.rateTimebase,
    );
    const profileCheck = coverageCheck(
      'profile',
      approved,
      query,
      profiles.length > 0,
    );
    if (!approved.length)
      return {
        profiles: [],
        checks: [
          profileCheck,
          ...ids
            .slice(1)
            .map((id) =>
              check(
                id,
                'not_checked',
                'An approved, complete profile is required before checking rate coverage.',
              ),
            ),
        ],
      };
    const rates = await this.store.rows(
      overlapping(
        this.store
          .query(UnitProductRate, context)
          .andWhere('r.profileId IN (:...ids)', {
            ids: approved.map((row) => row.id),
          }),
        query,
      ),
    );
    const checks = ['planning', 'sustained'].map((kind) => {
      const rows = rates.filter((row) => row.rateKind === kind);
      const intervals = rows
        .filter((row) => row.state === 'approved' && Number(row.rate) > 0)
        .map((row) =>
          intersection(
            row,
            approved.find((profile) => profile.id === row.profileId)!,
          ),
        );
      return coverageCheck(`${kind}_rate`, intervals, query, rows.length > 0);
    });
    return { profiles: approved, checks: [profileCheck, ...checks] };
  }
}
export function intersection(
  a: EffectiveSpan,
  b: EffectiveSpan,
): EffectiveSpan {
  const end = Math.min(
    a.effectiveTo?.getTime() ?? Infinity,
    b.effectiveTo?.getTime() ?? Infinity,
  );
  return {
    effectiveFrom: new Date(
      Math.max(a.effectiveFrom.getTime(), b.effectiveFrom.getTime()),
    ),
    effectiveTo: Number.isFinite(end) ? new Date(end) : null,
  };
}
