import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import { downtimeReport } from './downtime-report';
import {
  DowntimeReportQueryDto,
  OeeReportQueryDto,
  ReliabilityReportQueryDto,
} from './kpi-reports-v2.dto';
import {
  DowntimeReportView,
  OeeReportView,
  ReliabilityReportView,
} from './kpi-reports-v2.view';
import { oeeReport } from './oee-report';
import { reliabilityReport } from './reliability-report';
import { resolveReportScope } from './report-scope';

/**
 * KPI report read models of plan 2.7 (step 5, API03): side-effect free reads of the stored `kpi_results`
 * of the shown calculation runs, aggregated by summing numerators and denominators in SQL. Nothing is
 * computed or written on read; tenant and unit scope come from identity.
 */
@Injectable()
export class KpiReportsV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
  ) {}

  async oee(
    context: RequestContext,
    query: OeeReportQueryDto,
  ): Promise<AnalyticsResponse<OeeReportView>> {
    const manager = this.periods.manager;
    return oeeReport(
      manager,
      await resolveReportScope(manager, context, query),
      query,
    );
  }

  async downtime(
    context: RequestContext,
    query: DowntimeReportQueryDto,
  ): Promise<AnalyticsResponse<DowntimeReportView>> {
    const manager = this.periods.manager;
    return downtimeReport(
      manager,
      await resolveReportScope(manager, context, query),
      query,
    );
  }

  async reliability(
    context: RequestContext,
    query: ReliabilityReportQueryDto,
  ): Promise<AnalyticsResponse<ReliabilityReportView>> {
    const manager = this.periods.manager;
    return reliabilityReport(
      manager,
      await resolveReportScope(manager, context, query),
      query,
    );
  }
}
