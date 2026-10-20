import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReadOnlyAllowed } from '../../../auth/decorators/read-only-allowed.decorator';
import { assertMoneyVisible } from '../../../auth/money/money-access';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ExportReadsService } from '../../../exports/export-reads.service';
import { JobAccepted } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { ReportExportBodyDto } from './report-export.dto';
import { ReportExportService } from './report-export.service';
import { REPORT_KINDS } from './report-kinds';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Exports of the operating reports (owner 2026-10-20): a designed PDF with the Marun logo or an Excel
 * workbook of what a Reports page view shows. Provisional figures are exported and stamped. The download
 * needs the money capability only when the export holds money (it does only for callers who may see it).
 */
@ApiTags('v2 · Operating reports')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class ReportExportsV2Controller {
  constructor(
    private readonly exports: ReportExportService,
    private readonly reads: ExportReadsService,
  ) {}

  @ReadOnlyAllowed()
  @Post(':kind/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @ApiParam({ name: 'kind', enum: Object.keys(REPORT_KINDS) })
  @ApiOperation({
    summary:
      'Export an operating report as a designed PDF or an Excel workbook (202 + job)',
    description:
      'Requires `Idempotency-Key`. The query string is the report’s own (the same parameters and checks as its ' +
      'GET under /reports; daily also takes monthFrom). The report is read now with the caller’s units and money ' +
      'access and pinned on the job; provisional figures are stamped “PROVISIONAL – not approved”. Poll ' +
      '/exports/{id}; download from /reports/exports/{id}/download. 404 for an unknown kind.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Param('kind') kind: string,
    @Query() query: Record<string, unknown>,
    @Body() body: ReportExportBodyDto,
  ): Promise<JobAccepted> {
    const job = await this.exports.request(ctx, kind, query, body);
    return { jobId: job.id, statusUrl: `/api/v2/exports/${job.id}` };
  }

  @Get('exports/:id/download')
  @ApiProduces(CONTENT_TYPES.pdf, CONTENT_TYPES.xlsx)
  @ApiOperation({
    summary:
      'Download an operating report export (streamed; re-authorized now)',
    description:
      'Operating report exports only (404 otherwise). 409 EXPORT_NOT_READY while queued or running; 410 when ' +
      'cancelled, failed or expired; 403 MONEY_NOT_VISIBLE when the export holds money and the caller may not ' +
      'see it. Header `X-Content-SHA256`. Audited.',
  })
  async download(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const found = await this.reads.get(ctx, id);
    if (found.reportType !== 'ops_report') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Export not found',
      });
    }
    if (found.reportContent?.money) assertMoneyVisible(ctx);
    const { job, stream } = await this.reads.download(ctx, id);
    res.setHeader('X-Content-SHA256', job.contentHash ?? '');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const kind = job.reportContent?.kind ?? 'report';
    return new StreamableFile(stream, {
      type: CONTENT_TYPES[job.format] ?? 'application/octet-stream',
      disposition: `attachment; filename="proact-${kind}-${job.id}.${job.format}"`,
      length: job.sizeBytes ?? undefined,
    });
  }
}
