import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { toDec } from '../domain/actuals/decimal';
import { VersionState } from '../domain/profiles/profile.types';
import { FxRateType } from '../domain/valuation/valuation.types';
import { invalid, notFound } from '../profiles/profile-errors';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { validityOf } from '../profiles/profiles.service';
import {
  approveVersion,
  nextVersion,
  retireVersion,
} from '../profiles/versioning';
import { keysetPage } from '../v2/common/keyset-page';
import { FxRate } from './entities/fx-rate.entity';
import {
  recordValuationChanges,
  RevaluationRequested,
} from './valuation-events';

export interface NewFxRate {
  /** SME V5: the named rate table (default `economic`) */
  rateType?: FxRateType;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  source?: string | null;
}

export interface FxRateFilter {
  rateType?: FxRateType;
  fromCurrency?: string;
  toCurrency?: string;
  state?: VersionState;
  cursor?: string;
  limit: number;
}

const WHAT = 'FX rate';

/**
 * The approved, dated FX rate table (plan 2.6, D08 2026-10-09): versions per currency pair, drafted and
 * approved like master data (no overlap between approved versions of a pair; `supersede` closes the
 * predecessor at the new `from`). Rates apply to every unit of the tenant, so every write needs a
 * tenant-wide grant (403 `TENANT_SCOPE_REQUIRED`); reads are open to any tenant member.
 */
@Injectable()
export class FxRatesService {
  constructor(
    @InjectRepository(FxRate) private readonly rates: Repository<FxRate>,
  ) {}

  async create(context: RequestContext, input: NewFxRate): Promise<FxRate> {
    const tenantId = requireTenantId(context);
    assertTenantWideWriter(context, tenantId);
    if (input.fromCurrency === input.toCurrency) {
      throw invalid('SAME_CURRENCY', 'fromCurrency and toCurrency must differ');
    }
    const rate = toDec(input.rate);
    if (rate === null || !rate.isPositive() || rate.isZero()) {
      throw invalid('INVALID_VALUE', 'rate must be a decimal > 0');
    }
    const validity = validityOf(input);
    return this.rates.manager.transaction(async (manager) => {
      const key = {
        tenantId,
        rateType: input.rateType ?? 'economic',
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
      };
      const version = await nextVersion(manager, FxRate, key);
      return manager.save(
        manager.create(FxRate, {
          ...key,
          rate: input.rate,
          effectiveFrom: validity.from,
          effectiveTo: validity.to,
          version,
          state: 'draft',
          source: input.source?.trim() || null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** Versions of the tenant (keyset on effectiveFrom, id), optionally of one pair and state. */
  list(
    context: RequestContext,
    query: FxRateFilter,
  ): Promise<{ items: FxRate[]; nextCursor: string | null }> {
    const qb = scopedQuery(this.rates, 'f', { context });
    if (query.rateType)
      qb.andWhere('f.rateType = :type', { type: query.rateType });
    if (query.fromCurrency)
      qb.andWhere('f.fromCurrency = :from', { from: query.fromCurrency });
    if (query.toCurrency)
      qb.andWhere('f.toCurrency = :to', { to: query.toCurrency });
    if (query.state) qb.andWhere('f.state = :state', { state: query.state });
    return keysetPage(qb, {
      alias: 'f',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async get(context: RequestContext, id: string): Promise<FxRate> {
    const rate = await scopedQuery(this.rates, 'f', { context })
      .andWhere('f.id = :id', { id })
      .getOne();
    if (!rate) throw notFound(WHAT);
    return rate;
  }

  /**
   * Approves a draft; SME V7: the periods the rate values are queued for revaluation with the approval
   * (returned, so the caller sees what it triggered — late rates never change figures silently).
   */
  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<{ rate: FxRate; revaluation: RevaluationRequested | null }> {
    const rate = await this.get(context, id);
    assertTenantWideWriter(context, rate.tenantId);
    return this.rates.manager.transaction(async (manager) => {
      const result = await approveVersion(
        manager,
        FxRate,
        {
          id: rate.id,
          key: {
            tenantId: rate.tenantId,
            rateType: rate.rateType,
            fromCurrency: rate.fromCurrency,
            toCurrency: rate.toCurrency,
          },
          supersede,
          actorId: context.userId,
        },
        WHAT,
      );
      const approved = result.approved;
      const revaluation = await recordValuationChanges(manager, [
        {
          tenantId: approved.tenantId,
          subject: 'fx_rate',
          change: 'approved',
          row: approved,
        },
      ]);
      return { rate: approved, revaluation };
    });
  }

  async retire(
    context: RequestContext,
    id: string,
  ): Promise<{ rate: FxRate; revaluation: RevaluationRequested | null }> {
    const rate = await this.get(context, id);
    assertTenantWideWriter(context, rate.tenantId);
    const wasApproved = rate.state === 'approved';
    return this.rates.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        FxRate,
        { id: rate.id, actorId: context.userId },
        WHAT,
      );
      const changes = wasApproved
        ? [
            {
              tenantId: retired.tenantId,
              subject: 'fx_rate' as const,
              change: 'retired' as const,
              row: retired,
            },
          ]
        : [];
      return {
        rate: retired,
        revaluation: await recordValuationChanges(manager, changes),
      };
    });
  }
}
