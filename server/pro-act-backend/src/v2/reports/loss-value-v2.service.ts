import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import { lossValueReport, LossValueReportView } from './loss-value-report';
import { LossValueReportQueryDto } from './loss-value-v2.dto';
import { resolveReportScope } from './report-scope';

/** Loss value read model of plan 2.6 (VAL02, API03): stored valuation totals only, nothing computed or written. */
@Injectable()
export class LossValueReportV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
  ) {}

  async lossValue(
    context: RequestContext,
    query: LossValueReportQueryDto,
  ): Promise<AnalyticsResponse<LossValueReportView>> {
    const manager = this.periods.manager;
    return lossValueReport(
      manager,
      await resolveReportScope(manager, context, query),
      query,
    );
  }
}
