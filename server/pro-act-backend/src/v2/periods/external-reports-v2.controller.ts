import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ExternalReportDraft } from '../../domain/actuals/period/external-report';
import { ActualsJobsService } from '../../periods/actuals-jobs.service';
import { ExternalReportsService } from '../../periods/external-reports.service';
import { assertTenantWide } from '../../periods/period-scope';
import { JobAccepted } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ExternalReportCreateDto, ExternalReportCsvDto } from './period-v2.dto';
import { REPORT_IMPORTERS } from './period-roles';
import { ExternalReportV2View, toReportView } from './period-v2.view';

/** External daily-production records, e.g. Maximo (plan 2.4 step 4, ACT08). */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'external-production-reports', version: '2' })
export class ExternalReportsV2Controller {
  constructor(
    private readonly reports: ExternalReportsService,
    private readonly jobs: ActualsJobsService,
  ) {}

  @Post()
  @Idempotent()
  @Roles(...REPORT_IMPORTERS)
  @ApiOperation({
    summary: 'Import one external daily-production record (JSON)',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant (403 TENANT_SCOPE_REQUIRED: a site document). Lines ' +
      'must name units and products of the tenant (422 INVALID_REFERENCE). Same id + revision with the same content ' +
      '→ `outcome: duplicate`; with other content → 409 REPORT_REVISION_CONFLICT. A higher revision supersedes the ' +
      'current one (never summed) and is a correction candidate; a lower one is stored superseded (`stale`). ' +
      'Certified eligibility follows the status mapping (EXTERNAL_REPORT_CERTIFIED_STATUSES, default COMPLETED, RELEASED).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: ExternalReportCreateDto,
  ): Promise<ExternalReportV2View> {
    assertTenantWide(ctx, 'An external production report');
    const { report, outcome } = await this.reports.importOne(
      { tenantId: requireTenantId(ctx), userId: ctx.userId },
      draftOf(body),
    );
    return toReportView(report, outcome);
  }

  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Roles(...REPORT_IMPORTERS)
  @ApiOperation({
    summary: 'Import a CSV file of external records (202 + job)',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. Rows of one report id + revision form one record; each ' +
      'record is stored or reported in the job result (`problems`), never all-or-nothing across records.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async importCsv(
    @Ctx() ctx: RequestContext,
    @Body() body: ExternalReportCsvDto,
  ): Promise<JobAccepted> {
    assertTenantWide(ctx, 'An external production report');
    const job = await this.jobs.requestReportImport(
      ctx,
      requireTenantId(ctx),
      body.csv,
    );
    return { jobId: job.id, statusUrl: `/api/v2/actuals-jobs/${job.id}` };
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'One imported record with its state (current | superseded); foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ExternalReportV2View> {
    return toReportView(await this.reports.get(ctx, id));
  }
}

function draftOf(body: ExternalReportCreateDto): ExternalReportDraft {
  return {
    externalReportId: body.externalReportId,
    externalRevision: body.externalRevision,
    siteId: body.siteId ?? null,
    localProductionDate: body.localProductionDate,
    timezone: body.timezone ?? null,
    utcStart: new Date(body.utcStart),
    utcEnd: new Date(body.utcEnd),
    basis: body.basis,
    sourceStatus: body.sourceStatus,
    approvedAtSource: body.approvedAtSource
      ? new Date(body.approvedAtSource)
      : null,
    evidenceRef: body.evidenceRef ?? null,
    lines: body.lines.map((line) => ({
      unitId: line.unitId,
      productId: line.productId,
      gross: line.gross ?? null,
      good: line.good ?? null,
      reject: line.reject ?? null,
      uom: line.uom ?? null,
    })),
  };
}
