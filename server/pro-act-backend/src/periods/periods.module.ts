import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarModule } from '../calendar/calendar.module';
import { OutboxModule } from '../common/outbox/outbox.module';
import { SignalsModule } from '../signals/signals.module';
import { AccountingPoliciesService } from './accounting-policies.service';
import { ActualsAdjustmentsService } from './actuals-adjustments.service';
import { ActualsInputsLoader } from './actuals-inputs.loader';
import { ActualsJobsService } from './actuals-jobs.service';
import { ActualsRunnerService } from './actuals-runner.service';
import { ActualsProcessor } from './actuals.processor';
import { AccountingPolicy } from './entities/accounting-policy.entity';
import { ActualsAdjustment } from './entities/actuals-adjustment.entity';
import { ActualsJob } from './entities/actuals-job.entity';
import { ActualsResult } from './entities/actuals-result.entity';
import { ActualsRun } from './entities/actuals-run.entity';
import { ExternalProductionReport } from './entities/external-production-report.entity';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import { ProductionPeriod } from './entities/production-period.entity';
import { ExternalReportsService } from './external-reports.service';
import { PeriodMaterializerService } from './period-materializer.service';
import { PeriodRecalcConsumer } from './period-recalc.consumer';
import { PeriodSweepJob } from './period-sweep.job';
import { PeriodsService } from './periods.service';
import { SliceResolverService } from './slice-resolver.service';

/**
 * Production periods and actuals results of plan 2.4 (ACT01–ACT08, §3.1): period materialization with
 * product slices, the actuals runner (1.7 engine + D05 authority), governed adjustments, external
 * daily-production reports, recalculation triggers (outbox / inbox) and the leased actuals jobs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountingPolicy,
      ProductionPeriod,
      PeriodProductSlice,
      ActualsRun,
      ActualsResult,
      ActualsAdjustment,
      ExternalProductionReport,
      ActualsJob,
    ]),
    OutboxModule,
    SignalsModule,
    CalendarModule,
  ],
  providers: [
    AccountingPoliciesService,
    SliceResolverService,
    PeriodMaterializerService,
    ActualsInputsLoader,
    ActualsRunnerService,
    ExternalReportsService,
    ActualsJobsService,
    ActualsAdjustmentsService,
    PeriodsService,
    PeriodRecalcConsumer,
    ActualsProcessor,
    PeriodSweepJob,
  ],
  exports: [
    PeriodsService,
    ActualsRunnerService,
    ActualsJobsService,
    ActualsAdjustmentsService,
    ExternalReportsService,
    PeriodMaterializerService,
    AccountingPoliciesService,
  ],
})
export class PeriodsModule {}
