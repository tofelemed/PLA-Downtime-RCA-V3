import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEntry } from '../common/audit/audit-entry.entity';
import { OutboxModule } from '../common/outbox/outbox.module';
import { PeriodsModule } from '../periods/periods.module';
import { ApprovalService } from './approval.service';
import { ChangeProposalsService } from './change-proposals.service';
import { DraftLinesService } from './draft-lines.service';
import { ApprovalAction } from './entities/approval-action.entity';
import { ApprovalSnapshot } from './entities/approval-snapshot.entity';
import { PeriodChangeProposal } from './entities/period-change-proposal.entity';
import { ReconciliationLineSet } from './entities/reconciliation-line-set.entity';
import { ReconciliationLine } from './entities/reconciliation-line.entity';
import { LineSetWriter } from './line-set.writer';
import { RevisionLifecycleService } from './revision-lifecycle.service';
import { SubmissionService } from './submission.service';

/**
 * Reconciliation editor backend and approval workflow of plan 2.8 (ACC07–ACC10, WF01–WF05): atomic draft
 * saves, tolerance, submission gates, approval with separation of duties and snapshots, reject / revise /
 * cancel, change proposals for approved periods (also from plan restatements) and the append-only audit.
 * Stale marking and proposals on recalculation are bound into the 2.5 run by `AccountingModule`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReconciliationLineSet,
      ReconciliationLine,
      ApprovalAction,
      ApprovalSnapshot,
      PeriodChangeProposal,
      AuditEntry,
    ]),
    OutboxModule,
    PeriodsModule,
  ],
  providers: [
    LineSetWriter,
    DraftLinesService,
    SubmissionService,
    ApprovalService,
    RevisionLifecycleService,
    ChangeProposalsService,
  ],
  exports: [
    LineSetWriter,
    DraftLinesService,
    SubmissionService,
    ApprovalService,
    RevisionLifecycleService,
    ChangeProposalsService,
  ],
})
export class ReconciliationModule {}
