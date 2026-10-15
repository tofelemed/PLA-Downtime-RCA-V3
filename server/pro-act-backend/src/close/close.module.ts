import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthCloseAction } from './entities/month-close-action.entity';
import { MonthClose } from './entities/month-close.entity';
import { MonthCloseService } from './month-close.service';
import { WorkflowPoliciesService } from './workflow-policies.service';

/** Providers of `CloseModule` that need a database (the OpenAPI snapshot stubs them). */
export const CLOSE_SERVICES = [WorkflowPoliciesService, MonthCloseService];

export const CLOSE_ENTITIES = [MonthClose, MonthCloseAction];

/**
 * Close of the production ledger (EXPERT_REVIEW Area 3, SME R1–R4): month close with its working-day
 * calendar, sign-offs, materiality and lock. The lock of approved periods is enforced in the revise path
 * (`month-lock.ts`), which the reconciliation module calls directly.
 */
@Module({
  imports: [TypeOrmModule.forFeature(CLOSE_ENTITIES)],
  providers: CLOSE_SERVICES,
  exports: CLOSE_SERVICES,
})
export class CloseModule {}
