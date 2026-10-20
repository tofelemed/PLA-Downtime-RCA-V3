import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { CalculationRun } from '../../accounting/entities/calculation-run.entity';
import { LossLineEvidence } from '../../accounting/entities/loss-line-evidence.entity';
import { LossLine } from '../../accounting/entities/loss-line.entity';
import { PeriodLedgerTotal } from '../../accounting/entities/period-ledger-total.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { ActualsResult } from '../../periods/entities/actuals-result.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { periodScopeUnits } from '../../periods/period-scope';
import { notFound } from '../../profiles/profile-errors';
import { keysetPage } from '../common/keyset-page';
import {
  AnalyticsResponse,
  listResponse,
  ListResponse,
  ListScope,
} from '../common/response';
import {
  CalculationRunListQueryDto,
  PeriodAccountingQueryDto,
} from './period-accounting-v2.dto';
import {
  LedgerTotalsV2View,
  PeriodAccountingV2View,
  RunSummaryV2View,
  RunV2View,
  toLineView,
  toRevisionView,
  toRunSummaryView,
  toRunView,
  toTotalsView,
  toValuationTotalView,
} from './period-accounting-v2.view';
import { PeriodValuationTotal } from '../../valuation/entities/period-valuation-total.entity';

/**
 * v2 reads of plan 2.5: a period's accounting (revision, run, both ledgers' totals, lines with evidence)
 * as an analytical response, and the period's calculation runs (keyset on createdAt, newest first).
 * Reads never write: the default ledger view comes from the `oee_policy` version the run recorded.
 */
/** Runs-list columns: every run field but the input fingerprint, plus the keyset / scope keys. */
const RUN_SUMMARY_COLUMNS = [
  'id',
  'tenantId',
  'periodId',
  'createdAt',
  'revisionId',
  'status',
  'trigger',
  'engineVersion',
  'policyVersions',
  'inputHash',
  'actualsRunId',
  'supersedesRunId',
  'startedAt',
  'completedAt',
  'error',
  'stats',
] as const;

@Injectable()
export class PeriodAccountingV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    @InjectRepository(CalculationRun)
    private readonly runs: Repository<CalculationRun>,
  ) {}

  async get(
    context: RequestContext,
    periodId: string,
    query: PeriodAccountingQueryDto,
  ): Promise<AnalyticsResponse<PeriodAccountingV2View>> {
    const period = await this.period(context, periodId);
    const revision = await this.revisionOf(period, query);
    const run = revision?.currentRunId
      ? await this.runs.findOneBy({ id: revision.currentRunId })
      : null;
    const { lines, totals, evidence, valuationTotals } =
      await this.content(run);
    const data: PeriodAccountingV2View = {
      periodId: period.id,
      unitId: period.unitId,
      utcStart: period.utcStart.toISOString(),
      utcEnd: period.utcEnd.toISOString(),
      defaultLedgerView: run ? await this.defaultLedgerView(run) : null,
      revision: revision ? toRevisionView(revision) : null,
      run: run ? toRunView(run) : null,
      totals: totals.map(toTotalsView),
      valuationTotals: valuationTotals.map(toValuationTotalView),
      lines: lines.map((line) => toLineView(line, evidence)),
      coverageRatio: run ? await this.coverageOf(run) : null,
    };
    return analytics(period, data, {
      ...this.scope(context),
      unitIds: [period.unitId],
    });
  }

  async listRuns(
    context: RequestContext,
    periodId: string,
    query: CalculationRunListQueryDto,
  ): Promise<ListResponse<RunSummaryV2View>> {
    const period = await this.period(context, periodId);
    // the list never reads input_fingerprint (perf audit P07); the run detail does
    const qb = scopedQuery(this.runs, 'r', { context })
      .select(RUN_SUMMARY_COLUMNS.map((column) => `r.${column}`))
      .andWhere('r.periodId = :periodId', { periodId: period.id });
    const page = await keysetPage(qb, {
      alias: 'r',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toRunSummaryView), page.nextCursor, {
      ...this.scope(context),
      unitIds: [period.unitId],
    });
  }

  /** One run of the period with its input fingerprint (404 for a run of another period). */
  async getRun(
    context: RequestContext,
    periodId: string,
    runId: string,
  ): Promise<RunV2View> {
    const period = await this.period(context, periodId);
    const run = await scopedQuery(this.runs, 'r', { context })
      .andWhere('r.periodId = :periodId AND r.id = :runId', {
        periodId: period.id,
        runId,
      })
      .getOne();
    if (!run) throw notFound('Calculation run');
    return toRunView(run);
  }

  /** Lines, evidence and totals of a run (none without a run). */
  private async content(run: CalculationRun | null) {
    const manager = this.periods.manager;
    if (!run)
      return { lines: [], totals: [], evidence: [], valuationTotals: [] };
    const [lines, totals, valuationTotals] = await Promise.all([
      manager.find(LossLine, {
        where: { runId: run.id },
        order: {
          ledger: 'ASC',
          sliceId: 'ASC',
          segmentStart: 'ASC',
          autoKey: 'ASC',
        },
      }),
      manager.find(PeriodLedgerTotal, {
        where: { runId: run.id },
        order: { sliceId: 'ASC', ledger: 'ASC' },
      }),
      manager.find(PeriodValuationTotal, {
        where: { tenantId: run.tenantId, runId: run.id },
        order: {
          sliceId: 'ASC',
          ledger: 'ASC',
          kind: 'ASC',
          view: 'ASC',
          currency: 'ASC',
        },
      }),
    ]);
    const evidence = lines.length
      ? await manager.find(LossLineEvidence, {
          where: { lossLineId: In(lines.map((l) => l.id)) },
        })
      : [];
    return { lines, totals, evidence, valuationTotals };
  }

  private async period(
    context: RequestContext,
    id: string,
  ): Promise<ProductionPeriod> {
    const period = await scopedQuery(this.periods, 'p', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('p.id = :id', { id })
      .getOne();
    if (!period) throw notFound('Production period');
    return period;
  }

  /** `revision` wins; else `view`; else the approved revision when one exists, else the latest. */
  private async revisionOf(
    period: ProductionPeriod,
    query: PeriodAccountingQueryDto,
  ): Promise<AccountingRevision | null> {
    const repo = this.periods.manager.getRepository(AccountingRevision);
    if (query.revision !== undefined) {
      const found = await repo.findOneBy({
        periodId: period.id,
        revision: query.revision,
      });
      if (!found) throw notFound('Accounting revision');
      return found;
    }
    if (query.view) {
      const found = await repo.findOne({
        where: { periodId: period.id, lifecycle: query.view },
        order: { revision: 'DESC' },
      });
      if (!found)
        throw notFound(
          `${query.view === 'approved' ? 'Approved' : 'Draft'} accounting revision`,
        );
      return found;
    }
    const all = await repo.find({
      where: { periodId: period.id },
      order: { revision: 'DESC' },
    });
    return all.find((r) => r.lifecycle === 'approved') ?? all[0] ?? null;
  }

  private async defaultLedgerView(run: CalculationRun): Promise<string | null> {
    const ref = run.policyVersions.find((p) => p.kind === 'oee_policy');
    if (!ref) return null;
    const policy = await this.periods.manager.findOneBy(AccountingPolicy, {
      id: ref.id,
    });
    const view = policy?.body.defaultLedgerView;
    return typeof view === 'string' ? view : null;
  }

  /** Lowest actuals coverage of the run's actuals results (0 when a slice has none). */
  private async coverageOf(run: CalculationRun): Promise<number> {
    if (!run.actualsRunId) return 0;
    const results = await this.periods.manager.find(ActualsResult, {
      where: { actualsRunId: run.actualsRunId },
      select: { id: true, coverageRatio: true },
    });
    const ratios = results.map((r) =>
      r.coverageRatio === null ? 0 : Number(r.coverageRatio),
    );
    return ratios.length ? Math.min(...ratios) : 0;
  }

  private scope(context: RequestContext): ListScope {
    const units = periodScopeUnits(context);
    return {
      tenantId: requireTenantId(context),
      ...(units ? { unitIds: units } : {}),
    };
  }
}

function analytics(
  period: ProductionPeriod,
  data: PeriodAccountingV2View,
  scope: ListScope,
): AnalyticsResponse<PeriodAccountingV2View> {
  const flagged = (t: LedgerTotalsV2View) =>
    t.flags.length > 0 || t.residual === null;
  return {
    data,
    calculationRunId: data.run?.id ?? null,
    policyVersion: data.run
      ? data.run.policyVersions.map((p) => `${p.kind}@${p.version}`).join(',')
      : null,
    dataQuality: {
      missingCount: data.totals.filter((t) =>
        t.flags.includes('actuals_missing'),
      ).length,
      provisionalCount: data.totals.filter(flagged).length,
      notes: [...new Set(data.totals.flatMap((t) => t.flags))],
    },
    coverage: {
      from: period.utcStart.toISOString(),
      to: period.utcEnd.toISOString(),
      ratio: data.coverageRatio ?? 0,
    },
    isProvisional: data.revision?.lifecycle !== 'approved',
    asOf: new Date().toISOString(),
    scope,
  };
}
