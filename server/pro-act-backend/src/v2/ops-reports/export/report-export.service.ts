import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { canViewMoney } from '../../../auth/money/money-access';
import { appendAudit } from '../../../common/audit/audit-trail';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { createValidationPipe } from '../../../common/validation/validation-pipe.factory';
import { ExportJob } from '../../../exports/entities/export-job.entity';
import { presentationOf } from '../../../exports/export-presentation';
import { ProductionPeriod } from '../../../periods/entities/production-period.entity';
import { requireUser } from '../../../reconciliation/revision-access';
import { PlaReportsV2Service } from '../../pla-reports/pla-reports-v2.service';
import { KpiReportsV2Service } from '../../reports/kpi-reports-v2.service';
import { OpsReportsV2Service } from '../ops-reports-v2.service';
import { LossValueReportV2Service } from '../../reports/loss-value-v2.service';
import { MonthCloseService } from '../../../close/month-close.service';
import { REPORT_KINDS } from './report-kinds';
import { ReportExportBodyDto } from './report-export.dto';
import { ReportKind, ReportServices } from './report-kind';

const queryPipe = createValidationPipe();

/**
 * Report exports (owner 2026-10-20, `plans/REPORTS_R1_R12.md` § Exports): the report is read now through
 * the same services as the Reports page — the caller's tenant, unit scope and money access — and its
 * document is pinned on an `ops_report` export job with the plant's presentation; the worker renders it as
 * a designed PDF or a workbook. 202 with the job; download and expiry as every export.
 */
@Injectable()
export class ReportExportService {
  private readonly services: ReportServices;

  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    ops: OpsReportsV2Service,
    kpi: KpiReportsV2Service,
    pla: PlaReportsV2Service,
    value: LossValueReportV2Service,
    close: MonthCloseService,
  ) {
    this.services = { ops, kpi, pla, value, close };
  }

  async request(
    context: RequestContext,
    kind: string,
    rawQuery: Record<string, unknown>,
    body: ReportExportBodyDto,
  ): Promise<ExportJob> {
    const tenantId = requireTenantId(context);
    const userId = requireUser(context);
    const report: ReportKind<object> | undefined = REPORT_KINDS[kind];
    if (!report) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `no exportable report "${kind}"`,
      });
    }
    const query = (await queryPipe.transform(rawQuery, {
      type: 'query',
      metatype: report.query,
    })) as object;
    const built = await report.build({
      manager: this.periods.manager,
      context,
      query,
      money: canViewMoney(context),
      services: this.services,
    });
    return this.periods.manager.transaction(async (manager) => {
      const job = await manager.save(
        manager.create(ExportJob, {
          tenantId,
          reportType: 'ops_report',
          format: body.format,
          revisionSelector: 'report',
          filters: {
            from: built.document.from,
            to: built.document.to,
            unitIds: built.unitIds,
            revisionIds: null,
          },
          presentation: await presentationOf(manager, tenantId, body.currency),
          reportContent: built.document,
          unitIds: built.unitIds,
          requestedBy: userId,
          state: 'queued',
          counts: {
            accepted: 1,
            processed: 0,
            quarantined: 0,
            rejected: 0,
            pending: 1,
          },
          createdBy: userId,
        }),
      );
      await appendAudit(manager, [
        {
          tenantId,
          actorId: context.userId,
          action: 'export.requested',
          entityType: 'export_job',
          entityId: job.id,
          correlationId: context.correlationId,
          detail: {
            reportType: 'ops_report',
            report: kind,
            format: job.format,
            unitIds: job.unitIds,
            provisional: built.document.provisional,
          },
        },
      ]);
      return job;
    });
  }
}
