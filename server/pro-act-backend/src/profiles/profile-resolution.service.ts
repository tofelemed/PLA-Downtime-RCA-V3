import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { Dec } from '../domain/actuals/decimal';
import { RateKind } from '../domain/profiles/profile.types';
import { idealProductionSeconds } from '../domain/profiles/rate-math';
import { ProductionProfile } from './entities/production-profile.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { asUnprocessable } from './profile-errors';
import { ProfileReferences } from './profile-references';

export interface ProfileQuery {
  unitId: string;
  productId: string;
  /** default `normal` */
  operatingMode?: string;
  at: Date;
}

export type ProfileResolution =
  | {
      profile: ProductionProfile;
      /** the approved rate of each kind in force at `at` (absent kinds have none) */
      rates: Partial<Record<RateKind, UnitProductRate>>;
      reason: null;
    }
  | { profile: null; rates: Record<string, never>; reason: 'no_profile' };

export type IdealSeconds =
  | { seconds: Dec; rate: UnitProductRate; reason: null }
  | { seconds: null; rate: null; reason: 'no_profile' | 'no_sustained_rate' };

/**
 * Which approved profile and rates apply to a unit, product and mode at an instant (plan 2.2), for plan
 * generation (2.3), loss derivation (2.5), valuation (2.6) and OEE (2.7). Approved versions never
 * overlap, so at most one profile and one rate per kind are in force; none → `no_profile` (T41 null OEE).
 */
@Injectable()
export class ProfileResolutionService {
  constructor(
    @InjectRepository(ProductionProfile)
    private readonly profiles: Repository<ProductionProfile>,
    @InjectRepository(UnitProductRate)
    private readonly rates: Repository<UnitProductRate>,
    private readonly references: ProfileReferences,
  ) {}

  /** HTTP entry: references must be of the caller's tenant and unit scope (422 otherwise). */
  async resolveForCaller(
    context: RequestContext,
    query: ProfileQuery,
  ): Promise<ProfileResolution> {
    await this.references.assertUnit(context, query.unitId);
    await this.references.assertProduct(context, query.productId);
    return this.resolve(requireTenantId(context), query);
  }

  async resolve(
    tenantId: string,
    query: ProfileQuery,
  ): Promise<ProfileResolution> {
    const profile = await this.profiles
      .createQueryBuilder('p')
      .where(
        'p.tenantId = :tenantId AND p.unitId = :unitId AND p.productId = :productId',
        {
          tenantId,
          unitId: query.unitId,
          productId: query.productId,
        },
      )
      .andWhere('p.operatingMode = :mode', {
        mode: query.operatingMode ?? 'normal',
      })
      .andWhere(`p.state = 'approved'`)
      .andWhere(
        'p.effectiveFrom <= :at AND (p.effectiveTo IS NULL OR p.effectiveTo > :at)',
        {
          at: query.at,
        },
      )
      .orderBy('p.version', 'DESC')
      .getOne();
    if (!profile) return { profile: null, rates: {}, reason: 'no_profile' };
    const rows = await this.ratesInForce(tenantId, [profile.id], query.at);
    const rates: Partial<Record<RateKind, UnitProductRate>> = {};
    for (const rate of rows) rates[rate.rateKind] ??= rate;
    return { profile, rates, reason: null };
  }

  /**
   * Approved rates of several profiles in force at `at`, in one query (capacity gap report, plan 1.2):
   * by profile, kind and newest start. Approved versions never overlap, so at most one per profile and kind.
   */
  ratesInForce(
    tenantId: string,
    profileIds: readonly string[],
    at: Date,
  ): Promise<UnitProductRate[]> {
    if (profileIds.length === 0) return Promise.resolve([]);
    // [at, at + 1 ms) overlaps exactly the versions in force at `at`
    return this.rates
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.profileId IN (:...profileIds)', {
        tenantId,
        profileIds,
      })
      .andWhere(`r.state = 'approved'`)
      .andWhere('(r.effectiveTo IS NULL OR r.effectiveTo > :from)', {
        from: at,
      })
      .andWhere('r.effectiveFrom < :to', { to: new Date(at.getTime() + 1) })
      .orderBy('r.profileId')
      .addOrderBy('r.rateKind')
      .addOrderBy('r.effectiveFrom', 'DESC')
      .getMany();
  }

  /**
   * Approved rates of a profile overlapping `[from, to)` (to null = open), by kind and start: the
   * versions a period engine splits an interval by (T30).
   */
  approvedRates(
    profileId: string,
    window: { from: Date; to: Date | null },
    kind?: RateKind,
  ): Promise<UnitProductRate[]> {
    const qb = this.rates
      .createQueryBuilder('r')
      .where(`r.profileId = :profileId AND r.state = 'approved'`, { profileId })
      .andWhere('(r.effectiveTo IS NULL OR r.effectiveTo > :from)', {
        from: window.from,
      });
    if (window.to) qb.andWhere('r.effectiveFrom < :to', { to: window.to });
    if (kind) qb.andWhere('r.rateKind = :kind', { kind });
    return qb
      .orderBy('r.rateKind')
      .addOrderBy('r.effectiveFrom', 'DESC')
      .getMany();
  }

  /** KPI01 ideal time of `quantity` at the sustained rate in force at `query.at`. */
  async idealProductionSeconds(
    tenantId: string,
    query: ProfileQuery,
    quantity: string,
  ): Promise<IdealSeconds> {
    const resolution = await this.resolve(tenantId, query);
    if (!resolution.profile)
      return { seconds: null, rate: null, reason: 'no_profile' };
    const rate = resolution.rates.sustained;
    if (!rate)
      return { seconds: null, rate: null, reason: 'no_sustained_rate' };
    const seconds = asUnprocessable(() =>
      idealProductionSeconds(quantity, rate),
    );
    return { seconds, rate, reason: null };
  }
}
