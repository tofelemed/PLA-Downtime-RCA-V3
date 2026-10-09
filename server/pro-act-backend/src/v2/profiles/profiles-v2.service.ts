import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  restrictedUnitIds,
  scopedQuery,
} from '../../common/query/scoped-query';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { ValuationRate } from '../../profiles/entities/valuation-rate.entity';
import { ProfilesService } from '../../profiles/profiles.service';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { ProfileListQueryDto } from './profile-v2.dto';
import {
  ProfileV2View,
  RateV2View,
  toProfileView,
  toRateView,
  toValuationRateView,
  ValuationRateV2View,
} from './profile-v2.view';
import { RateListQueryDto, ValuationRateListQueryDto } from './rate-v2.dto';

/** v2 list reads of plan 2.2: tenant-scoped (unit-scoped through the profile), keyset pages. */
@Injectable()
export class ProfilesV2Service {
  constructor(
    @InjectRepository(ProductionProfile)
    private readonly profiles: Repository<ProductionProfile>,
    @InjectRepository(UnitProductRate)
    private readonly rates: Repository<UnitProductRate>,
    @InjectRepository(ValuationRate)
    private readonly valuationRates: Repository<ValuationRate>,
    private readonly profileVersions: ProfilesService,
  ) {}

  async listProfiles(
    context: RequestContext,
    query: ProfileListQueryDto,
  ): Promise<ListResponse<ProfileV2View>> {
    const qb = scopedQuery(this.profiles, 'p', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId)
      qb.andWhere('p.unitId = :unitId', { unitId: query.unitId });
    if (query.productId)
      qb.andWhere('p.productId = :productId', { productId: query.productId });
    if (query.operatingMode)
      qb.andWhere('p.operatingMode = :mode', { mode: query.operatingMode });
    if (query.state) qb.andWhere('p.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'p',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map(toProfileView),
      page.nextCursor,
      scope(context),
    );
  }

  /** Rates of one profile (404 when the profile is not visible to the caller). */
  async listRates(
    context: RequestContext,
    profileId: string,
    query: RateListQueryDto,
  ): Promise<ListResponse<RateV2View>> {
    const profile = await this.profileVersions.get(context, profileId);
    const qb = scopedQuery(this.rates, 'r', { context }).andWhere(
      'r.profileId = :profileId',
      {
        profileId: profile.id,
      },
    );
    if (query.rateKind)
      qb.andWhere('r.rateKind = :kind', { kind: query.rateKind });
    if (query.state) qb.andWhere('r.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'r',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toRateView), page.nextCursor, {
      ...scope(context),
      unitIds: [profile.unitId],
    });
  }

  async listValuationRates(
    context: RequestContext,
    query: ValuationRateListQueryDto,
  ): Promise<ListResponse<ValuationRateV2View>> {
    const qb = scopedQuery(this.valuationRates, 'v', { context });
    const units = restrictedUnitIds(context, requireTenantId(context));
    if (units) {
      // unit-scoped callers see only rates of profiles of their units
      qb.innerJoin('v.profile', 'p').andWhere(
        'p.unitId IN (:...scopeProfileUnits)',
        {
          scopeProfileUnits: units,
        },
      );
    }
    if (query.profileId)
      qb.andWhere('v.profileId = :profileId', { profileId: query.profileId });
    if (query.impactCodeId) {
      qb.andWhere('v.impactCodeId = :impactCodeId', {
        impactCodeId: query.impactCodeId,
      });
    }
    if (query.basis) qb.andWhere('v.basis = :basis', { basis: query.basis });
    if (query.state) qb.andWhere('v.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'v',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map(toValuationRateView),
      page.nextCursor,
      scope(context),
    );
  }
}

function scope(context: RequestContext): { tenantId: string } {
  return { tenantId: requireTenantId(context) };
}
