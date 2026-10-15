import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthCloseAction } from './entities/month-close-action.entity';
import { MonthClose } from './entities/month-close.entity';
import { PeriodDataHold } from './entities/period-data-hold.entity';
import { MonthCloseService } from './month-close.service';
import { PeriodSlaService } from './period-sla.service';
import { ReconciliationQueueService } from './reconciliation-queue.service';
import { ReconciliationSlaService } from './reconciliation-sla.service';
import { WorkflowPoliciesService } from './workflow-policies.service';

/** Providers of `CloseModule` that need a database (the OpenAPI snapshot stubs them). */
export const CLOSE_SERVICES = [
  WorkflowPoliciesService,
  MonthCloseService,
  ReconciliationSlaService,
  PeriodSlaService,
  ReconciliationQueueService,
];

export const CLOSE_ENTITIES = [MonthClose, MonthCloseAction, PeriodDataHold];

/**
 * Close of the production ledger (EXPERT_REVIEW Area 3, SME R1–R6): month close with its working-day
 * calendar, sign-offs, materiality and lock; reconciliation SLA clocks, data holds and escalation. The lock of approved periods is enforced in the revise path
 * (`month-lock.ts`), which the reconciliation module calls directly.
 */
@Module({
  imports: [TypeOrmModule.forFeature(CLOSE_ENTITIES)],
  providers: CLOSE_SERVICES,
  exports: CLOSE_SERVICES,
})
export class CloseModule {}
