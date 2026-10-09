import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { RateTimebase } from '../domain/actuals/actuals.types';
import { toDec } from '../domain/actuals/decimal';
import {
  POSITIVE_RATE_KINDS,
  RateKind,
  Validity,
} from '../domain/profiles/profile.types';
import { covers } from '../domain/profiles/version-window';
import { ProductionProfile } from './entities/production-profile.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { invalid, invalidTransition, notFound } from './profile-errors';
import { recordBaselineChanges } from './profile-events';
import { ProfilesService, validityOf } from './profiles.service';
import { approveVersion, nextVersion, retireVersion } from './versioning';

export interface NewRate {
  rateKind: RateKind;
  rate: string;
  timebase: RateTimebase;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

const WHAT = 'rate';

/**
 * Rate versions of a profile (plan 2.2, PLAN01/PLAN06): drafts with the next version per profile and
 * kind, approval without overlap (or superseding the predecessor at the new `from`), retirement.
 * Historical corrections are new versions; approved rows are never edited.
 */
@Injectable()
export class RatesService {
  constructor(
    @InjectRepository(UnitProductRate)
    private readonly rates: Repository<UnitProductRate>,
    private readonly profiles: ProfilesService,
  ) {}

  async create(
    context: RequestContext,
    profileId: string,
    input: NewRate,
  ): Promise<UnitProductRate> {
    const profile = await this.profiles.get(context, profileId);
    if (profile.state === 'retired') {
      throw invalidTransition('profile', 'retired', 'rated');
    }
    assertRate(input.rateKind, input.rate);
    const validity = validityOf(input);
    assertWithinProfile(profile, validity);
    return this.rates.manager.transaction(async (manager) => {
      const key = { profileId: profile.id, rateKind: input.rateKind };
      const version = await nextVersion(manager, UnitProductRate, key);
      return manager.save(
        manager.create(UnitProductRate, {
          tenantId: profile.tenantId,
          ...key,
          rate: input.rate,
          timebase: input.timebase,
          effectiveFrom: validity.from,
          effectiveTo: validity.to,
          version,
          state: 'draft',
          source: 'manual',
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** A rate of the caller's tenant whose profile the caller may see; 404 otherwise. */
  async get(context: RequestContext, id: string): Promise<UnitProductRate> {
    const rate = await scopedQuery(this.rates, 'r', { context })
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!rate) throw notFound('Rate');
    await this.profiles.get(context, rate.profileId);
    return rate;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<UnitProductRate> {
    const rate = await this.get(context, id);
    return this.rates.manager.transaction(async (manager) => {
      const result = await approveVersion(
        manager,
        UnitProductRate,
        {
          id,
          key: { profileId: rate.profileId, rateKind: rate.rateKind },
          supersede,
          actorId: context.userId,
        },
        `${rate.rateKind} rate`,
      );
      await recordBaselineChanges(manager, [
        { row: result.approved, change: 'approved' },
        ...(result.superseded
          ? [{ row: result.superseded, change: 'superseded' as const }]
          : []),
      ]);
      return result.approved;
    });
  }

  async retire(context: RequestContext, id: string): Promise<UnitProductRate> {
    const rate = await this.get(context, id);
    return this.rates.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        UnitProductRate,
        { id: rate.id, actorId: context.userId },
        WHAT,
      );
      if (rate.state === 'approved') {
        await recordBaselineChanges(manager, [
          { row: retired, change: 'retired' },
        ]);
      }
      return retired;
    });
  }
}

/** 422 `INVALID_RATE`: negative, or zero for a kind that divides quantities. */
export function assertRate(kind: RateKind, rate: string): void {
  const value = toDec(rate);
  if (
    value === null ||
    value.isNegative() ||
    (POSITIVE_RATE_KINDS.has(kind) && value.isZero())
  ) {
    throw invalid(
      'INVALID_RATE',
      `a ${kind} rate must be a decimal ${POSITIVE_RATE_KINDS.has(kind) ? '> 0' : '≥ 0'}`,
    );
  }
}

/** A rate starts inside its profile version (422 `RATE_OUTSIDE_PROFILE`). */
function assertWithinProfile(
  profile: ProductionProfile,
  validity: Validity,
): void {
  const inside = covers(
    { from: profile.effectiveFrom, to: profile.effectiveTo },
    validity.from,
  );
  if (!inside) {
    throw invalid(
      'RATE_OUTSIDE_PROFILE',
      'effectiveFrom must lie within the profile version validity',
    );
  }
}
