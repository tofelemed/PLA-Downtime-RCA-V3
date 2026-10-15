import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
  /** SME V7: an authorised provisional rate for dates whose final rate is missing (bounded window) */
  provisional?: boolean;
}

export interface FxRateFilter {
  rateType?: FxRateType;
  fromCurrency?: string;
  toCurrency?: string;
  state?: VersionState;
  provisional?: boolean;
  cursor?: string;
  limit: number;
}

const WHAT = 'FX rate';

/** SME V7: a provisional rate only fills dates without an approved final rate of the same table and pair. */
async function assertNoFinalRate(
  manager: EntityManager,
  rate: FxRate,
): Promise<void> {
  const covering = await manager
    .createQueryBuilder(FxRate, 'f')
    .where('f.tenantId = :tenantId AND f.rateType = :rateType', {
      tenantId: rate.tenantId,
      rateType: rate.rateType,
    })
    .andWhere('f.fromCurrency = :fromCurrency AND f.toCurrency = :toCurrency', {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
    })
    .andWhere(`f.state = 'approved' AND f.provisional = false`)
    .andWhere('f.effectiveFrom < :to', {
      to: rate.effectiveTo ?? new Date(8.64e15),
    })
    .andWhere('(f.effectiveTo IS NULL OR f.effectiveTo > :from)', {
      from: rate.effectiveFrom,
    })
    .getMany();
  if (covering.length === 0) return;
  throw new ConflictException({
    code: 'FINAL_RATE_EXISTS',
    message:
      'an approved final FX rate already covers part of this window: a provisional rate only fills missing dates',
    details: { finalRateIds: covering.map((f) => f.id) },
  });
}

/**
 * The approved, dated FX rate table (plan 2.6, D08 2026-10-09): versions per currency pair, drafted and
 * approved like master data (no overlap between approved versions of a pair; `supersede` closes the
 * predecessor at the new `from`); SME V7 provisional versions are authorised the same way and flagged.
 * Rates apply to every unit of the tenant, so every write needs a
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
    const provisional = input.provisional === true;
    if (provisional && validity.to === null) {
      throw invalid(
        'PROVISIONAL_RATE_UNBOUNDED',
        'a provisional FX rate covers a bounded window: effectiveTo is required',
      );
    }
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
          provisional,
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
    if (query.provisional !== undefined)
      qb.andWhere('f.provisional = :provisional', {
        provisional: query.provisional,
      });
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
   * (returned, so the caller sees what it triggered — late rates never change figures silently). Final
   * and provisional versions are separate families (each never overlaps itself); a provisional draft is
   * refused (409 `FINAL_RATE_EXISTS`) where an approved final rate already covers part of its window. A
   * final rate approved over a provisional one replaces it in the revaluation it queues.
   */
  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<{ rate: FxRate; revaluation: RevaluationRequested | null }> {
    const rate = await this.get(context, id);
    assertTenantWideWriter(context, rate.tenantId);
    return this.rates.manager.transaction(async (manager) => {
      // final and provisional approvals of one pair are serialised, so the check below cannot race
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `fx_rates_pair:${rate.tenantId}:${rate.rateType}:${rate.fromCurrency}:${rate.toCurrency}`,
      ]);
      if (rate.provisional) await assertNoFinalRate(manager, rate);
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
            provisional: String(rate.provisional),
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
