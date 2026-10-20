import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import { resolveReportScope } from '../reports/report-scope';
import { eventStatus, EventStatusView } from './event-status';
import {
  CreateShiftNoteDto,
  EventStatusQueryDto,
  ProductionByProductQueryDto,
  QualityDispositionsQueryDto,
  RestatementsQueryDto,
  ShiftHandoverQueryDto,
  ReliabilityTrendQueryDto,
  TransitionPerformanceQueryDto,
  ChronicSporadicQueryDto,
  RateLossQueryDto,
  CodingComplianceQueryDto,
} from './ops-reports-v2.dto';
import { codingCompliance, CodingComplianceView } from './coding-compliance';
import { rateLoss, RateLossView } from './rate-loss';
import { chronicSporadic, ChronicSporadicView } from './chronic-sporadic';
import { reliabilityTrend, ReliabilityTrendView } from './reliability-trend';
import {
  transitionPerformance,
  TransitionPerformanceView,
} from './transition-performance';
import {
  qualityDispositions,
  QualityDispositionsView,
} from './quality-dispositions';
import { restatementsReport, RestatementsView } from './restatements-report';
import {
  productionByProduct,
  ProductionByProductView,
} from './production-by-product';
import { shiftHandover, ShiftHandoverView } from './shift-handover';
import { createShiftNote, ShiftNoteView } from './shift-notes';

/**
 * Persona reports R1–R12 (`plans/REPORTS_R1_R12.md`): side-effect free reads of the stored results of the
 * shown runs and of the events; tenant and unit scope come from identity.
 */
@Injectable()
export class OpsReportsV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
  ) {}

  async productionByProduct(
    context: RequestContext,
    query: ProductionByProductQueryDto,
  ): Promise<AnalyticsResponse<ProductionByProductView>> {
    const manager = this.periods.manager;
    const scope = await resolveReportScope(manager, context, query);
    return productionByProduct(manager, scope, query.groupBy ?? 'total');
  }

  async eventStatus(
    context: RequestContext,
    query: EventStatusQueryDto,
  ): Promise<EventStatusView> {
    const manager = this.periods.manager;
    return eventStatus(
      manager,
      await resolveReportScope(manager, context, query),
    );
  }

  shiftHandover(
    context: RequestContext,
    query: ShiftHandoverQueryDto,
  ): Promise<AnalyticsResponse<ShiftHandoverView>> {
    return shiftHandover(this.periods.manager, context, query);
  }

  async restatements(
    context: RequestContext,
    query: RestatementsQueryDto,
  ): Promise<RestatementsView> {
    const manager = this.periods.manager;
    return restatementsReport(
      manager,
      await resolveReportScope(manager, context, query),
    );
  }

  async qualityDispositions(
    context: RequestContext,
    query: QualityDispositionsQueryDto,
  ): Promise<QualityDispositionsView> {
    const manager = this.periods.manager;
    return qualityDispositions(
      manager,
      await resolveReportScope(manager, context, query),
    );
  }

  async transitionPerformance(
    context: RequestContext,
    query: TransitionPerformanceQueryDto,
  ): Promise<TransitionPerformanceView> {
    const manager = this.periods.manager;
    return transitionPerformance(
      manager,
      await resolveReportScope(manager, context, query),
    );
  }

  async reliabilityTrend(
    context: RequestContext,
    query: ReliabilityTrendQueryDto,
  ): Promise<AnalyticsResponse<ReliabilityTrendView>> {
    const manager = this.periods.manager;
    return reliabilityTrend(
      manager,
      await resolveReportScope(manager, context, query),
    );
  }

  async chronicSporadic(
    context: RequestContext,
    query: ChronicSporadicQueryDto,
  ): Promise<AnalyticsResponse<ChronicSporadicView>> {
    const manager = this.periods.manager;
    const scope = await resolveReportScope(manager, context, query);
    return chronicSporadic(manager, scope, query.groupBy ?? 'reason');
  }

  async rateLoss(
    context: RequestContext,
    query: RateLossQueryDto,
  ): Promise<AnalyticsResponse<RateLossView>> {
    const manager = this.periods.manager;
    return rateLoss(manager, await resolveReportScope(manager, context, query));
  }

  async codingCompliance(
    context: RequestContext,
    query: CodingComplianceQueryDto,
  ): Promise<AnalyticsResponse<CodingComplianceView>> {
    const manager = this.periods.manager;
    return codingCompliance(
      manager,
      await resolveReportScope(manager, context, query),
    );
  }

  createShiftNote(
    context: RequestContext,
    body: CreateShiftNoteDto,
  ): Promise<ShiftNoteView> {
    return createShiftNote(this.periods.manager, context, body);
  }
}
