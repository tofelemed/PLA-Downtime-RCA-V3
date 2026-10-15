import { assertTenantWideWriter } from './profile-scope';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { toDec } from '../domain/actuals/decimal';
import {
  PRODUCT_VALUE_BASES,
  RATIO_BASES,
  ValuationBasis,
} from '../domain/profiles/profile.types';
import { ProductionProfile } from './entities/production-profile.entity';
import { ValuationRate } from './entities/valuation-rate.entity';
import { invalid, invalidReference, notFound } from './profile-errors';
import { recordBaselineChanges } from './profile-events';
import { ProfileReferences } from './profile-references';
import { ProfilesService, validityOf } from './profiles.service';
import { approveVersion, nextVersion, retireVersion } from './versioning';
import { reportingCurrencies } from '../valuation/valuation-policy.store';

export interface NewValuationRate {
  profileId?: string;
  impactCodeId?: string;
  basis: ValuationBasis;
  value: string;
  /** absent for a ratio basis (`rework_yield`) */
  currency?: string;
  perUom?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

const WHAT = 'valuation rate';
const HOURS = 'h';

/**
 * Valuation rate versions (plan 2.2, VAL01, D08): contribution margin or standard cost per quantity of
 * a profile (per its `quantity_uom`, never converted), cost per hour of an impact code. Margin versions
 * are kept as approved history; approval and supersede follow the same no-overlap rule as rates.
 */
@Injectable()
export class ValuationRatesService {
  constructor(
    @InjectRepository(ValuationRate)
    private readonly rates: Repository<ValuationRate>,
    private readonly profiles: ProfilesService,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewValuationRate,
  ): Promise<ValuationRate> {
    const owner = await this.ownerOf(context, input);
    this.assertWritable(context, owner.profileId);
    const currency = await this.currencyOf(owner.tenantId, input);
    const validity = validityOf(input);
    return this.rates.manager.transaction(async (manager) => {
      const key = {
        profileId: owner.profileId,
        impactCodeId: owner.impactCodeId,
        basis: input.basis,
      };
      const version = await nextVersion(manager, ValuationRate, key);
      return manager.save(
        manager.create(ValuationRate, {
          tenantId: owner.tenantId,
          ...key,
          value: input.value,
          currency,
          perUom: owner.perUom,
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

  /**
   * The value's currency after checking the value: a money basis needs a reporting currency and a value
   * ≥ 0; a ratio (`rework_yield`, SME V2) has none and lies in (0, 1].
   */
  private async currencyOf(
    tenantId: string,
    input: NewValuationRate,
  ): Promise<string | null> {
    const value = toDec(input.value);
    if (RATIO_BASES.has(input.basis)) {
      if (value === null || value.lte(0) || value.gt(1)) {
        throw invalid('INVALID_VALUE', 'a rework yield is a decimal in (0, 1]');
      }
      if (input.currency) {
        throw invalid('CURRENCY_NOT_ALLOWED', 'a rework yield has no currency');
      }
      return null;
    }
    if (value === null || value.isNegative()) {
      throw invalid('INVALID_VALUE', 'value must be a decimal ≥ 0');
    }
    await this.assertReportedCurrency(tenantId, input.currency ?? '');
    return input.currency ?? null;
  }

  /** D08 (2026-10-09): rates are entered in a reporting currency of the tenant's valuation policy (IRR or USD). */
  private async assertReportedCurrency(
    tenantId: string,
    currency: string,
  ): Promise<void> {
    const allowed = await reportingCurrencies(this.rates.manager, tenantId);
    if (!allowed.includes(currency)) {
      throw invalid(
        'CURRENCY_NOT_REPORTED',
        `currency must be one of the reporting currencies (${allowed.join(', ') || 'none decided'})`,
      );
    }
  }

  /** Tenant-wide valuation rates (no profile) need a tenant-wide grant; profile rates are unit-scoped. */
  private assertWritable(
    context: RequestContext,
    profileId: string | null,
  ): void {
    if (!profileId) assertTenantWideWriter(context, requireTenantId(context));
  }

  async get(context: RequestContext, id: string): Promise<ValuationRate> {
    const rate = await scopedQuery(this.rates, 'v', { context })
      .andWhere('v.id = :id', { id })
      .getOne();
    if (!rate) throw notFound('Valuation rate');
    if (rate.profileId) await this.profiles.get(context, rate.profileId);
    return rate;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<ValuationRate> {
    const rate = await this.get(context, id);
    this.assertWritable(context, rate.profileId);
    return this.rates.manager.transaction(async (manager) => {
      const key = {
        profileId: rate.profileId,
        impactCodeId: rate.impactCodeId,
        basis: rate.basis,
      };
      const result = await approveVersion(
        manager,
        ValuationRate,
        { id, key, supersede, actorId: context.userId },
        WHAT,
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

  async retire(context: RequestContext, id: string): Promise<ValuationRate> {
    const rate = await this.get(context, id);
    this.assertWritable(context, rate.profileId);
    return this.rates.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        ValuationRate,
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

  /** The owner (profile xor impact code) and the unit the value is per. */
  private async ownerOf(
    context: RequestContext,
    input: NewValuationRate,
  ): Promise<{
    tenantId: string;
    profileId: string | null;
    impactCodeId: string | null;
    perUom: string;
  }> {
    assertBasisOwner(input);
    if (input.impactCodeId) {
      await this.references.assertImpactCode(context, input.impactCodeId);
      const perUom =
        input.basis === 'cost_per_hour' ? HOURS : input.perUom?.trim();
      if (!perUom || (input.perUom && !sameUom(input.perUom, perUom))) {
        throw invalid(
          'UOM_MISMATCH',
          'perUom is "h" for cost per hour and required for a cost per unit',
        );
      }
      return {
        tenantId: requireTenantId(context),
        profileId: null,
        impactCodeId: input.impactCodeId,
        perUom,
      };
    }
    const profile = await this.profileOf(context, input.profileId ?? '');
    const perUom = profile.quantityUom ?? input.perUom?.trim();
    if (!perUom || (input.perUom && !sameUom(input.perUom, perUom))) {
      throw invalid('UOM_MISMATCH', 'perUom must be the profile quantity unit');
    }
    return {
      tenantId: profile.tenantId,
      profileId: profile.id,
      impactCodeId: null,
      perUom,
    };
  }

  private async profileOf(
    context: RequestContext,
    profileId: string,
  ): Promise<ProductionProfile> {
    try {
      return await this.profiles.get(context, profileId);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw invalidReference('profileId', 'profile');
      }
      throw error;
    }
  }
}

/** Exactly one owner, and the basis fits it (422 `INVALID_OWNER`). */
function assertBasisOwner(input: NewValuationRate): void {
  const owners =
    Number(Boolean(input.profileId)) + Number(Boolean(input.impactCodeId));
  const fits =
    owners === 1 &&
    (input.basis !== 'cost_per_hour' || Boolean(input.impactCodeId)) &&
    (input.basis !== 'contribution_margin' || Boolean(input.profileId)) &&
    (!PRODUCT_VALUE_BASES.has(input.basis) || Boolean(input.profileId));
  if (!fits) {
    throw invalid(
      'INVALID_OWNER',
      'give profileId (contribution_margin, standard_cost and the SME V2 product values) or impactCodeId (cost_per_hour, standard_cost)',
    );
  }
}

/** Units are compared case- and space-insensitively, never converted (1.7 default). */
function sameUom(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  return norm(a) === norm(b);
}
