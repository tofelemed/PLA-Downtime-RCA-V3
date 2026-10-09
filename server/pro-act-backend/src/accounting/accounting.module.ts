import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../common/outbox/outbox.module';
import { PeriodsModule } from '../periods/periods.module';
import { AccountingCommandsService } from './accounting-commands.service';
import { AccountingInputsLoader } from './accounting-inputs.loader';
import { AccountingRunService } from './accounting-run.service';
import { AccountingRevision } from './entities/accounting-revision.entity';
import { CalculationRun } from './entities/calculation-run.entity';
import { LossLineEvidence } from './entities/loss-line-evidence.entity';
import { LossLine } from './entities/loss-line.entity';
import { PeriodLedgerTotal } from './entities/period-ledger-total.entity';
import { WorkflowRevisionHooks } from '../reconciliation/workflow-revision-hooks';
import { AccountingRevisionHooks } from './revision-hooks';

/**
 * Loss accounting engine and calculation runs of plan 2.5 (ACC01–ACC08, FND03): accounting revisions,
 * immutable runs with both ledgers, evidence and totals. Registers the full recalculation on the 2.4
 * recompute port, so every `PeriodRecalculateRequested` job runs actuals first and then the ledgers. The
 * revision hooks are bound to the 2.8 workflow (stale marking, change proposals).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountingRevision,
      CalculationRun,
      LossLine,
      LossLineEvidence,
      PeriodLedgerTotal,
    ]),
    OutboxModule,
    PeriodsModule,
  ],
  providers: [
    AccountingInputsLoader,
    AccountingRunService,
    AccountingCommandsService,
    { provide: AccountingRevisionHooks, useClass: WorkflowRevisionHooks },
  ],
  exports: [AccountingRunService, AccountingCommandsService],
})
export class AccountingModule {}
