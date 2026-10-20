import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEntry } from '../common/audit/audit-entry.entity';
import { DeliveryReconciliationService } from './delivery-reconciliation.service';
import { ExportJobSource } from './entities/export-job-source.entity';
import { ExportJob } from './entities/export-job.entity';
import { ExportJobsProcessor } from './export-jobs.processor';
import { ExportJobsService } from './export-jobs.service';
import { ExportReadsService } from './export-reads.service';
import { ExportRenderer } from './export-renderer';
import { ExportRequestsService } from './export-requests.service';
import { ExportStorage } from './export-storage';
import { ExportPdfWriter } from './pdf/export-pdf';
import { RcaCaseModule } from '../rca-case/rca-case.module';
import { RcaCaseContentService } from './rca-case/rca-case-content.service';

/**
 * Exports and downstream delivery of plan 2.9 (AN03, API04, WF03, D12): immutable CSV and PDF report exports
 * bound to approval snapshots (request → pinned sources → leased render job → private file store →
 * re-authorized download), and the delivery reconciliation of `PeriodApproved` messages. Domain-message
 * contracts are validated by the outbox relay (`common/domain-events`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ExportJob, ExportJobSource, AuditEntry]),
    RcaCaseModule,
  ],
  providers: [
    ExportStorage,
    ExportRenderer,
    ExportPdfWriter,
    RcaCaseContentService,
    ExportReadsService,
    ExportRequestsService,
    ExportJobsService,
    ExportJobsProcessor,
    DeliveryReconciliationService,
  ],
  exports: [
    ExportReadsService,
    ExportRequestsService,
    ExportJobsService,
    DeliveryReconciliationService,
  ],
})
export class ExportsModule {}
