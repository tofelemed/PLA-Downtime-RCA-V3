import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarModule } from '../calendar/calendar.module';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ProductionProfile } from '../profiles/entities/production-profile.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { PlanGenerationJob } from './entities/plan-generation-job.entity';
import { PlanPeriod } from './entities/plan-period.entity';
import { PlanProductSlice } from './entities/plan-product-slice.entity';
import { PlanScenario } from './entities/plan-scenario.entity';
import { PlanVersion } from './entities/plan-version.entity';
import { PlanApprovalService } from './plan-approval.service';
import { PlanGenerationJobsService } from './plan-generation-jobs.service';
import { PlanGenerationProcessor } from './plan-generation.processor';
import { PlanInputsLoader } from './plan-inputs.loader';
import { PlanLegacyBridge } from './plan-legacy-bridge.service';
import { PlanPeriodGeneratorService } from './plan-period-generator.service';
import { PlanReviewService } from './plan-review.service';
import { PlanReferences } from './plan-references';
import { PlanScenariosService } from './plan-scenarios.service';
import { PlanVersionsService } from './plan-versions.service';

/**
 * Plan versions and period generation of plan 2.3 (PLAN02–PLAN05): scenarios, versioned plans with
 * product slices, the period generator (preview, or 202 job run by the worker), approval with the PLAN04
 * overlap rule, and the v1 legacy bridge.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionPlan,
      PlanScenario,
      PlanVersion,
      PlanProductSlice,
      PlanPeriod,
      PlanGenerationJob,
      ProductionProfile,
    ]),
    CalendarModule,
    ProfilesModule,
  ],
  providers: [
    PlanReferences,
    PlanScenariosService,
    PlanVersionsService,
    PlanInputsLoader,
    PlanPeriodGeneratorService,
    PlanApprovalService,
    PlanReviewService,
    PlanGenerationJobsService,
    PlanGenerationProcessor,
    PlanLegacyBridge,
  ],
  exports: [
    PlanScenariosService,
    PlanVersionsService,
    PlanPeriodGeneratorService,
    PlanApprovalService,
    PlanReviewService,
    PlanGenerationJobsService,
    PlanLegacyBridge,
  ],
})
export class PlansModule {}
