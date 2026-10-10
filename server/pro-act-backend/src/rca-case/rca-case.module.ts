import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../common/outbox/outbox.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { PeriodsModule } from '../periods/periods.module';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RcaCaseLink } from '../rca/entities/rca-case-link.entity';
import { RcaTriggerEvaluation } from '../rca/entities/rca-trigger-evaluation.entity';
import { RCA } from '../rca/rca.entity';
import { RcaActionsService } from './rca-actions.service';
import { RcaCasesService } from './rca-cases.service';
import { RcaLinksService } from './rca-links.service';
import { RcaRecommendationsService } from './rca-recommendations.service';
import { RcaVerificationService } from './rca-verification.service';
import { RcaTriggerSweepJob } from './triggers/rca-trigger-sweep.job';
import { RcaTriggerConsumer } from './triggers/rca-trigger.consumer';
import { RcaTriggerService } from './triggers/rca-trigger.service';

/**
 * RCA integration and action feedback (plan 3.9): v2 cases, links with evidence packages, the
 * policy / rule driven trigger service (event consumer + open-event sweep), recommendations, actions
 * and their verification job. Loaded by the API (v2 routes) and the worker (sweeps, consumer).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RCA,
      RcaCaseLink,
      RcaTriggerEvaluation,
      RcaAction,
      ProductionEvent,
    ]),
    OutboxModule,
    PeriodsModule,
    FeatureFlagsModule,
  ],
  providers: [
    RcaCasesService,
    RcaLinksService,
    RcaRecommendationsService,
    RcaActionsService,
    RcaVerificationService,
    RcaTriggerService,
    RcaTriggerConsumer,
    RcaTriggerSweepJob,
  ],
  exports: [
    RcaCasesService,
    RcaLinksService,
    RcaRecommendationsService,
    RcaActionsService,
    RcaVerificationService,
    RcaTriggerService,
    RcaTriggerSweepJob,
  ],
})
export class RcaCaseModule {}
