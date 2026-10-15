import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import {
  consolidateSiteLoss,
  SiteLossRow,
  SiteLossView,
} from '../../domain/accounting/site-consolidation';
import { AnalyticsResponse } from '../common/response';
import { LOSS_TREE_KINDS } from '../pla-reports/pla-reports.dto';
import { reportEnvelope } from '../reports/kpi-reports-v2.view';
import { resolveReportScope } from '../reports/report-scope';
import {
  params,
  periodStats,
  policyVersions,
  SHOWN,
} from '../reports/report-sql';
import { SiteLossQueryDto } from './plant-flow-v2.dto';

/**
 * Loss lines of each shown period ($6 ledger, $7 kinds): the approved plan lines of an approved revision,
 * else the run's active lines; with the period's unit, start and the cause's origin unit.
 */
const SITE_LOSS_SQL = `${SHOWN}
SELECT s."unit_id"::text AS "unit_id",
       COALESCE(e."origin_unit_id", e."unit_id", s."unit_id")::text AS "origin_unit_id",
       l."uom", sum(l."quantity")::text AS "quantity", count(*)::int AS "lines",
       EXISTS (SELECT 1 FROM "plant_flow_routes" fr
                WHERE fr."tenant_id" = $1 AND fr."from_unit_id" = s."unit_id" AND fr."state" = 'approved'
                  AND fr."effective_from" <= p."utc_start" AND (fr."effective_to" IS NULL OR fr."effective_to" > p."utc_start"))
         AS "upstream"
  FROM shown s
  JOIN "production_periods" p ON p."id" = s."period_id"
  JOIN LATERAL (
    SELECT a."cause_event_id", a."uom", a."quantity" FROM "approved_loss_lines" a
     WHERE $6::text = 'plan' AND s."lifecycle" = 'approved' AND a."revision_id" = s."revision_id"
       AND a."tenant_id" = $1 AND a."kind"::text = ANY($7::text[])
    UNION ALL
    SELECT r."cause_event_id", r."uom", r."quantity" FROM "loss_lines" r
     WHERE r."run_id" = s."run_id" AND r."tenant_id" = $1 AND r."period_id" = s."period_id"
       AND r."ledger" = $6::loss_ledger AND r."state" = 'active' AND r."source" <> 'candidate_superseded'
       AND r."kind"::text = ANY($7::text[])
       AND NOT ($6::text = 'plan' AND s."lifecycle" = 'approved' AND EXISTS (
             SELECT 1 FROM "approved_loss_lines" x WHERE x."revision_id" = s."revision_id" AND x."tenant_id" = $1))
  ) l ON true
  LEFT JOIN "production_events" e ON e."id" = l."cause_event_id"
 GROUP BY 1, 2, 3, 6`;

interface Row {
  unit_id: string;
  origin_unit_id: string;
  uom: string | null;
  quantity: string;
  lines: number;
  upstream: boolean;
}

/**
 * SME E2 / Q13 site loss: the loss of the shown periods consolidated at the site boundary (units that feed
 * no other unit in the approved flow map), by origin, next to every unit's own impact. Read-only.
 */
@Injectable()
export class SiteLossV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
  ) {}

  async siteLoss(
    context: RequestContext,
    query: SiteLossQueryDto,
  ): Promise<AnalyticsResponse<SiteLossView & { ledger: string }>> {
    const manager = this.periods.manager;
    const scope = await resolveReportScope(manager, context, query);
    const ledger = query.ledger ?? 'plan';
    const rows: Row[] = await manager.query(SITE_LOSS_SQL, [
      ...params(scope),
      ledger,
      [...LOSS_TREE_KINDS],
    ]);
    const data = consolidateSiteLoss(
      rows.map(
        (r): SiteLossRow => ({
          unitId: r.unit_id,
          originUnitId: r.origin_unit_id,
          uom: r.uom,
          quantity: r.quantity,
          lines: r.lines,
          upstream: r.upstream,
        }),
      ),
    );
    const stats = await periodStats(manager, scope);
    return reportEnvelope(
      { ...data, ledger },
      {
        scope,
        stats,
        policyVersions: await policyVersions(manager, stats.runIds),
        provisionalData: false,
        notes: [],
      },
    );
  }
}
