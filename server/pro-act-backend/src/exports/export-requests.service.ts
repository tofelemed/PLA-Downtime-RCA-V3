import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { appendAudit } from '../common/audit/audit-trail';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { envInt } from '../common/helpers/time-bounds';
import { restrictedUnitIds } from '../common/query/scoped-query';
import {
  assertBodyUnitsInScope,
  assertTenantWide,
} from '../periods/period-scope';
import {
  invalid,
  invalidReference,
  invalidTransition,
} from '../profiles/profile-errors';
import { requireUser } from '../reconciliation/revision-access';
import {
  ExportCounts,
  ExportFilters,
  ExportFormat,
  ExportJob,
  ExportReportType,
  ExportSelector,
} from './entities/export-job.entity';
import { pinnedLabelsOf } from './export-labels';
import { presentationOf } from './export-presentation';
import { ExportReadsService } from './export-reads.service';
import { namedRevisionUnits, pinNamed, pinPublished } from './export-sources';
import { PdfCurrency } from './pdf/pdf-model';

const DAY_MS = 86_400_000;

export interface ExportRequest {
  reportType: ExportReportType;
  format: ExportFormat;
  revisionSelector: ExportSelector;
  from?: string;
  to?: string;
  unitIds?: string[];
  revisionIds?: string[];
  /** PDF only: the reporting currency money is printed in (USD by default) */
  currency?: PdfCurrency;
}

/** What a validated request pins and records. */
interface ExportPlan {
  filters: ExportFilters;
  unitIds: string[] | null;
  pin: (
    manager: EntityManager,
    ids: { tenantId: string; jobId: string },
  ) => Promise<number>;
}

function countsOf(accepted: number): ExportCounts {
  return {
    accepted,
    processed: 0,
    quarantined: 0,
    rejected: 0,
    pending: accepted,
  };
}

/** A PDF is laid out in memory, so it holds far fewer period revisions than a streamed CSV. */
function assertExportSize(format: ExportFormat, accepted: number): void {
  const max =
    format === 'pdf'
      ? envInt('EXPORT_PDF_MAX_SOURCES', 500)
      : envInt('EXPORT_MAX_SOURCES', 50_000);
  if (accepted <= max) return;
  throw invalid(
    'EXPORT_TOO_LARGE',
    `the ${format.toUpperCase()} export would contain ${accepted} period revisions; narrow the window or units (max ${max})`,
  );
}

function invalidSelector(message: string) {
  return invalid('INVALID_SELECTOR', message);
}

/**
 * Export requests and cancellation (plan 2.9, §15.2 `POST /exports`, API04). A request is validated
 * against the caller's tenant and unit scope, then — in one transaction with the job and its audit row —
 * the approved revisions it will render are pinned, so the content is fixed at request time. Rendering is
 * the worker's (`ExportJobsService`); the caller gets 202 with the job.
 */
@Injectable()
export class ExportRequestsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reads: ExportReadsService,
  ) {}

  async request(
    context: RequestContext,
    body: ExportRequest,
  ): Promise<ExportJob> {
    const tenantId = requireTenantId(context);
    const userId = requireUser(context);
    const plan = await this.plan(context, tenantId, body);
    return this.dataSource.transaction(async (manager) => {
      const presentation =
        body.format === 'pdf'
          ? await presentationOf(manager, tenantId, body.currency)
          : null;
      const job = await manager.save(
        manager.create(ExportJob, {
          tenantId,
          reportType: body.reportType,
          format: body.format,
          revisionSelector: body.revisionSelector,
          filters: plan.filters,
          presentation,
          unitIds: plan.unitIds,
          requestedBy: userId,
          state: 'queued',
          counts: countsOf(0),
          createdBy: userId,
        }),
      );
      const accepted = await plan.pin(manager, { tenantId, jobId: job.id });
      assertExportSize(body.format, accepted);
      await manager.update(ExportJob, job.id, {
        counts: countsOf(accepted),
        labels: await pinnedLabelsOf(manager, job),
      });
      await this.audit(manager, job, context, 'export.requested');
      return manager.findOneByOrFail(ExportJob, { id: job.id });
    });
  }

  /**
   * Cancels a queued job at once; a running job is flagged and the worker stops it before the next page
   * (state `cancelled`, file removed, `partial` when some sources were rendered). A finished job is 409.
   */
  async cancel(context: RequestContext, id: string): Promise<ExportJob> {
    const job = await this.reads.get(context, id);
    return this.dataSource.transaction(async (manager) => {
      const [rows]: [Array<{ id: string }>, number] = await manager.query(
        `UPDATE "export_jobs"
            SET "cancel_requested" = true,
                "state" = CASE WHEN "state" = 'queued' THEN 'cancelled'::export_job_state ELSE "state" END,
                "finished_at" = CASE WHEN "state" = 'queued' THEN now() ELSE "finished_at" END,
                "updated_at" = now(), "updated_by" = $2, "row_version" = "row_version" + 1
          WHERE "id" = $1 AND "state" IN ('queued', 'running') RETURNING "id"`,
        [job.id, context.userId],
      );
      if (rows.length === 0)
        throw invalidTransition('export job', job.state, 'cancelled');
      await this.audit(manager, job, context, 'export.cancel_requested');
      return manager.findOneByOrFail(ExportJob, { id: job.id });
    });
  }

  private plan(
    context: RequestContext,
    tenantId: string,
    body: ExportRequest,
  ): Promise<ExportPlan> {
    return body.revisionSelector === 'published'
      ? this.publishedPlan(context, tenantId, body)
      : this.namedPlan(context, tenantId, body);
  }

  private async publishedPlan(
    context: RequestContext,
    tenantId: string,
    body: ExportRequest,
  ): Promise<ExportPlan> {
    if (!body.from || !body.to || body.revisionIds?.length) {
      throw invalidSelector(
        'revisionSelector published needs from and to, and no revisionIds',
      );
    }
    const from = new Date(body.from);
    const to = new Date(body.to);
    if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
    const maxDays = envInt('EXPORT_MAX_WINDOW_DAYS', 400);
    if (to.getTime() - from.getTime() > maxDays * DAY_MS) {
      throw invalid(
        'WINDOW_TOO_LARGE',
        `export at most ${maxDays} days at once`,
      );
    }
    const unitIds = body.unitIds?.length
      ? [...new Set(body.unitIds)].sort()
      : null;
    if (unitIds) {
      assertBodyUnitsInScope(context, unitIds);
      await this.assertTenantUnits(tenantId, unitIds);
    } else {
      assertTenantWide(context, 'A tenant-wide export');
    }
    return {
      filters: {
        from: from.toISOString(),
        to: to.toISOString(),
        unitIds,
        revisionIds: null,
      },
      unitIds,
      pin: (manager, ids) => pinPublished(manager, ids, { from, to, unitIds }),
    };
  }

  private async namedPlan(
    context: RequestContext,
    tenantId: string,
    body: ExportRequest,
  ): Promise<ExportPlan> {
    if (
      !body.revisionIds?.length ||
      body.from ||
      body.to ||
      body.unitIds?.length
    ) {
      throw invalidSelector(
        'revisionSelector revision_ids needs revisionIds only',
      );
    }
    const revisionIds = [...new Set(body.revisionIds)].sort();
    const units = await namedRevisionUnits(
      this.dataSource.manager,
      tenantId,
      revisionIds,
      restrictedUnitIds(context, tenantId),
    );
    return {
      filters: { from: null, to: null, unitIds: null, revisionIds },
      unitIds: units,
      pin: (manager, ids) => pinNamed(manager, ids, revisionIds),
    };
  }

  private async assertTenantUnits(
    tenantId: string,
    unitIds: string[],
  ): Promise<void> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "units" WHERE "id" = ANY($1::uuid[]) AND "tenant_id" = $2`,
      [unitIds, tenantId],
    );
    if (rows.length !== unitIds.length)
      throw invalidReference('unitIds', 'unit');
  }

  private audit(
    manager: EntityManager,
    job: ExportJob,
    context: RequestContext,
    action: string,
  ): Promise<void> {
    return appendAudit(manager, [
      {
        tenantId: job.tenantId,
        actorId: context.userId,
        action,
        entityType: 'export_job',
        entityId: job.id,
        correlationId: context.correlationId,
        detail: {
          reportType: job.reportType,
          format: job.format,
          revisionSelector: job.revisionSelector,
          unitIds: job.unitIds,
        },
      },
    ]);
  }
}
