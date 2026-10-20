import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import { resolveReportScope } from '../reports/report-scope';
import { eventStatus, EventStatusView } from './event-status';
import {
  EventStatusQueryDto,
  ProductionByProductQueryDto,
} from './ops-reports-v2.dto';
import {
  productionByProduct,
  ProductionByProductView,
} from './production-by-product';

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
}
