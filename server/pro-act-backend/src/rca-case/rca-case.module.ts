import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../common/outbox/outbox.module';
import { PeriodsModule } from '../periods/periods.module';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RcaCaseLink } from '../rca/entities/rca-case-link.entity';
import { RcaTriggerEvaluation } from '../rca/entities/rca-trigger-evaluation.entity';
import { RCA } from '../rca/rca.entity';
import { RcaActionQueueService } from './rca-action-queue.service';
import { RcaActionsService } from './rca-actions.service';
import { RcaBaselineCorrectionsService } from './rca-baseline-corrections.service';
import { RcaAnalysesService } from './rca-analyses.service';
import { RcaAttachmentsService } from './rca-attachments.service';
import { RcaCaseCommandsService } from './rca-case-commands.service';
import { RcaCasesService } from './rca-cases.service';
import { RcaCaseWorkflowService } from './rca-case-workflow.service';
import { RcaCauseReportService } from './rca-cause-report.service';
import { RcaCausesService } from './rca-causes.service';
import { RcaHistoryService } from './rca-history.service';
import { RcaLinksService } from './rca-links.service';
import { RcaOccurrencesService } from './rca-occurrences.service';
import { RcaRecommendationsService } from './rca-recommendations.service';
import { RcaVerificationService } from './rca-verification.service';
import { RcaTriggerSweepJob } from './triggers/rca-trigger-sweep.job';
import { RcaTriggerConsumer } from './triggers/rca-trigger.consumer';
import { RcaTriggerService } from './triggers/rca-trigger.service';
import { RcaApprovedTriggerService } from './triggers/rca-approved-trigger.service';

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
  ],
  providers: [
    RcaCasesService,
    RcaCaseWorkflowService,
    RcaCaseCommandsService,
    RcaAnalysesService,
    RcaAttachmentsService,
    RcaLinksService,
    RcaHistoryService,
    RcaCausesService,
    RcaCauseReportService,
    RcaOccurrencesService,
    RcaRecommendationsService,
    RcaActionsService,
    RcaActionQueueService,
    RcaBaselineCorrectionsService,
    RcaVerificationService,
    RcaTriggerService,
    RcaApprovedTriggerService,
    RcaTriggerConsumer,
    RcaTriggerSweepJob,
  ],
  exports: [
    RcaCasesService,
    RcaCaseWorkflowService,
    RcaCaseCommandsService,
    RcaAnalysesService,
    RcaAttachmentsService,
    RcaLinksService,
    RcaHistoryService,
    RcaCausesService,
    RcaCauseReportService,
    RcaOccurrencesService,
    RcaRecommendationsService,
    RcaActionsService,
    RcaActionQueueService,
    RcaBaselineCorrectionsService,
    RcaVerificationService,
    RcaTriggerService,
    RcaApprovedTriggerService,
    RcaTriggerSweepJob,
  ],
})
export class RcaCaseModule {}
