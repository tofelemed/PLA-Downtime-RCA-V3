import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { badActorTrigger } from '../../domain/rca/bad-actor';
import { isCriticalAsset, parseRcaPolicy } from '../../domain/rca/rca-policy';
import {
  DefaultBasis,
  ValuationViewSource,
} from '../../domain/valuation/valuation.types';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { singleView } from '../../rca-case/approved-snapshot-view';
import { defaultValuationBasis } from '../../valuation/valuation-policy.store';
import { AnalyticsResponse } from '../common/response';
import {
  BadActorFigures,
  badActorFigures,
  BadActorItemView,
  secondsOf,
  valueView,
} from './bad-actor-report';
import {
  AssetRow,
  assetsOf,
  FiringRow,
  firings,
  modeSeconds,
  reviewWindow,
  frozenViewsOfScope,
  uncoveredPeriodCount,
} from './bad-actor-sql';
import { BadActorReportQueryDto } from './bad-actor-v2.dto';
import { reportEnvelope } from './kpi-reports-v2.view';
import { valuationStatusOf } from './loss-value-default';
import { periodStats } from './report-sql';
import { ReportScope, resolveReportScope } from './report-scope';

const DEFAULT_WINDOW_DAYS = 90;

/** An asset id without an asset row of the tenant: nothing to evaluate. */
const UNKNOWN_ASSET: BadActorItemView['trigger'] = {
  state: 'off',
  seconds: 0,
  thresholdSeconds: null,
  windowDays: null,
  criticalAsset: false,
  firedAt: null,
  rcaId: null,
  outcome: null,
};

export interface BadActorReportView {
  /** `YYYY-MM` in the plant calendar (`calendar`) */
  month: string;
  calendar: 'gregorian' | 'persian';
  from: string;
  to: string;
  /** CA8 rolling window: the tenant RCA policy's cumulative window (pilot 90 days) */
  windowDays: number;
  groupBy: string;
  rankBy: string;
  limit: number;
  /**
   * SME V8: valuation view of the value column — the view frozen when the window's periods were approved;
   * the policy's default view only when none froze one or they froze different ones (`viewSource`)
   */
  view: DefaultBasis;
  /** where `view` comes from (additive) */
  viewSource: ValuationViewSource;
  currency: string;
  /** unit of measure the quantity ranking compares in (the one with the most approved loss) */
  uom: string | null;
  valuationStatus: 'approved' | 'provisional';
  approvedPeriods: number;
  periods: number;
  /**
   * QA re-test N7: of the periods not approved, those no approved plan covers ("No approved plan covers
   * this period"); they are not waiting for approval (additive)
   */
  uncoveredPeriods: number;
  basis: string;
  items: BadActorItemView[];
}

/** How the review is built, in words shown under the table (QA re-test: sentence case, no rule codes). */
const BASIS =
  'Lost quantity and value: approved plan loss lines of approved periods starting in the window, ' +
  'attributed to the asset (and failure mode) of their cause stop. Stops: unplanned stops and failure ' +
  'work orders starting in the window. Trigger: the cumulative same-mode downtime rule of the asset’s ' +
  'RCA policy';

/**
 * CA8 monthly bad-actor review (SME 14 Oct 2026): the top assets or asset failure modes of a rolling
 * window by approved lost quantity, approved value (the view the periods were approved in) or stop count, with the
 * cumulative bad-actor trigger state per asset. Tenant and units from identity; read-only.
 */
@Injectable()
export class BadActorReportV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    private readonly policies: AccountingPoliciesService,
  ) {}

  async report(
    context: RequestContext,
    query: BadActorReportQueryDto,
  ): Promise<AnalyticsResponse<BadActorReportView>> {
    const manager = this.periods.manager;
    const tenantId = requireTenantId(context);
    const tenantPolicy = parseRcaPolicy(
      (
        await this.policies.rcaPolicyInForce(
          manager,
          { tenantId, unitId: null },
          new Date(),
        )
      ).body,
    );
    const windowDays =
      tenantPolicy.cumulative?.windowDays ?? DEFAULT_WINDOW_DAYS;
    const window = await reviewWindow(manager, {
      tenantId,
      month: query.month,
      days: windowDays,
    });
    const scope = await resolveReportScope(manager, context, {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      unitIds: query.unitIds,
    });
    const frozen = singleView(await frozenViewsOfScope(manager, scope));
    const request = {
      group: query.groupBy ?? 'asset',
      rank: query.rankBy ?? 'quantity',
      limit: query.limit ?? 5,
      view: frozen ?? (await defaultValuationBasis(manager, tenantId)),
      currency: query.currency ?? 'USD',
    };
    const { figures, uom } = await badActorFigures(manager, scope, request);
    const items = await this.items(manager, scope, figures);
    const stats = await periodStats(manager, scope);
    const uncoveredPeriods = await uncoveredPeriodCount(manager, scope);
    const data: BadActorReportView = {
      month: query.month,
      calendar: window.calendar,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      windowDays,
      groupBy: request.group,
      rankBy: request.rank,
      limit: request.limit,
      view: request.view,
      viewSource: frozen ? 'approved_snapshot' : 'policy_default',
      currency: request.currency,
      uom,
      valuationStatus: valuationStatusOf(stats),
      approvedPeriods: stats.approved,
      periods: stats.periods,
      uncoveredPeriods,
      basis: BASIS,
      items,
    };
    return reportEnvelope(data, {
      scope,
      stats,
      policyVersions: [],
      provisionalData: items.some((i) => i.value?.fxProvisional === true),
      notes: [],
    });
  }

  private async items(
    manager: EntityManager,
    scope: ReportScope,
    figures: BadActorFigures[],
  ): Promise<BadActorItemView[]> {
    const assetIds = [...new Set(figures.map((f) => f.key.split('|')[0]))];
    if (assetIds.length === 0) return [];
    const [assets, seconds, fired] = await Promise.all([
      assetsOf(manager, scope.tenantId, assetIds),
      modeSeconds(manager, scope, assetIds),
      firings(manager, scope, assetIds),
    ]);
    const triggers = await this.triggers(manager, scope, {
      assets,
      seconds: new Map(seconds.map((r) => [r.asset_id, Number(r.seconds)])),
      fired: new Map(fired.map((r) => [r.asset_id, r])),
    });
    return figures.map((figure, index) => {
      const [assetId, ...mode] = figure.key.split('|');
      const asset = assets.find((a) => a.id === assetId);
      return {
        rank: index + 1,
        key: figure.key,
        assetId,
        assetCode: asset?.code ?? null,
        assetName: asset?.name ?? null,
        unitId: asset?.unit_id ?? null,
        failureMode: mode.length ? mode.join('|') : null,
        stops: figure.stops,
        downtimeSeconds: secondsOf(figure.stop),
        quantities: figure.quantityRows.map((r) => ({
          uom: r.uom,
          quantity: r.quantity,
        })),
        quantity: figure.quantity,
        value: valueView(figure.value),
        trigger: triggers.get(assetId) ?? UNKNOWN_ASSET,
      };
    });
  }

  /** Cumulative trigger state per asset under the RCA policy of the asset's unit at the window end. */
  private async triggers(
    manager: EntityManager,
    scope: ReportScope,
    input: {
      assets: AssetRow[];
      seconds: Map<string, number>;
      fired: Map<string, FiringRow>;
    },
  ): Promise<Map<string, BadActorItemView['trigger']>> {
    const result = new Map<string, BadActorItemView['trigger']>();
    const units = [...new Set(input.assets.map((a) => a.unit_id))];
    const policies = new Map(
      await Promise.all(
        units.map(
          async (unitId) =>
            [
              unitId,
              (
                await this.policies.resolveRca(
                  manager,
                  { tenantId: scope.tenantId, unitId },
                  scope.to,
                )
              ).policy,
            ] as const,
        ),
      ),
    );
    for (const asset of input.assets) {
      const policy = policies.get(asset.unit_id);
      if (!policy) continue;
      const firing = input.fired.get(asset.id) ?? null;
      result.set(asset.id, {
        ...badActorTrigger({
          policy,
          seconds: Math.floor(input.seconds.get(asset.id) ?? 0),
          criticalAsset: isCriticalAsset(policy, asset.criticality),
          fired: firing !== null,
        }),
        firedAt: firing ? new Date(firing.fired_at).toISOString() : null,
        rcaId: firing?.rca_id ?? null,
        outcome: firing?.outcome ?? null,
      });
    }
    return result;
  }
}
