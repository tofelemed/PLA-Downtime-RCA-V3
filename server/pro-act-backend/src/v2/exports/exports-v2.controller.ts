import { ReadOnlyAllowed } from '../../auth/decorators/read-only-allowed.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import {
  ExportReadsService,
  ExportSourceRow,
} from '../../exports/export-reads.service';
import { ExportRequestsService } from '../../exports/export-requests.service';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { keysetPage } from '../common/keyset-page';
import { JobAccepted, listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  CreateExportDto,
  ExportListQueryDto,
  ExportSourcesQueryDto,
} from './export-v2.dto';
import { ExportV2View, toExportView } from './export-v2.view';

function scopeOf(ctx: RequestContext) {
  const tenantId = requireTenantId(ctx);
  const unitIds = restrictedUnitIds(ctx, tenantId);
  return unitIds ? { tenantId, unitIds } : { tenantId };
}

function positionAfter(cursor: string | undefined): number {
  if (!cursor) return 0;
  const { sortValue } = CursorCodec.decode(cursor);
  if (typeof sortValue !== 'number') throw invalidCursor();
  return sortValue;
}

/**
 * Report exports (plan 2.9, §15.2 `/exports`, API04, AN03): immutable CSV or PDF files bound to approved
 * revisions pinned at request time. Any tenant member may export what it can read; a unit-limited caller
 * names units of its scope (a tenant-wide export needs a tenant-wide grant, 403). Status, sources,
 * cancellation and download are scoped like the content (404 otherwise); the download is re-authorized
 * when it happens and expires.
 */
@ApiTags('v2 · Exports')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'exports', version: '2' })
export class ExportsV2Controller {
  constructor(
    private readonly requests: ExportRequestsService,
    private readonly reads: ExportReadsService,
  ) {}

  @ReadOnlyAllowed()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @ApiOperation({
    summary:
      'Request a report export (202 + job); the approved revisions it contains are pinned now',
    description:
      'Requires `Idempotency-Key`. 422 INVALID_SELECTOR / INVALID_RANGE / WINDOW_TOO_LARGE / EXPORT_TOO_LARGE / ' +
      'REVISION_NOT_APPROVED; 422 INVALID_REFERENCE for units or revisions outside the tenant or the caller’s ' +
      'unit scope; 403 TENANT_SCOPE_REQUIRED for a unit-limited caller without unitIds.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateExportDto,
  ): Promise<JobAccepted> {
    const job = await this.requests.request(ctx, body);
    return { jobId: job.id, statusUrl: `/api/v2/exports/${job.id}` };
  }

  @Get()
  @ApiOperation({ summary: 'Export jobs the caller may see, newest first' })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: ExportListQueryDto,
  ): Promise<ListResponse<ExportV2View>> {
    const page = await keysetPage(this.reads.list(ctx), {
      alias: 'j',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const now = new Date();
    return listResponse(
      page.items.map((job) => toExportView(job, now)),
      page.nextCursor,
      scopeOf(ctx),
      now,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Status of an export job',
    description:
      'state queued → running → completed | failed | cancelled; counts {accepted, processed, quarantined, rejected, pending}; ' +
      'downloadUrl while the file is available. Another tenant’s or an out-of-scope job is 404.',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ExportV2View> {
    return toExportView(await this.reads.get(ctx, id));
  }

  @Get(':id/sources')
  @ApiOperation({
    summary:
      'The approved revisions, snapshots and calculation runs an export is built from',
  })
  async sources(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ExportSourcesQueryDto,
  ): Promise<ListResponse<ExportSourceRow>> {
    const rows = await this.reads.sources(ctx, id, {
      after: positionAfter(query.cursor),
      limit: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({ sortValue: last.position, id: last.revisionId })
        : null;
    return listResponse(items, nextCursor, scopeOf(ctx));
  }

  @ReadOnlyAllowed()
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({
    summary:
      'Cancel a queued or running export (no file is kept; 409 once finished)',
    description: 'Requires `Idempotency-Key`.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async cancel(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ExportV2View> {
    return toExportView(await this.requests.cancel(ctx, id));
  }

  @Get(':id/download')
  @ApiProduces('text/csv', 'application/pdf')
  @ApiOperation({
    summary: 'Download the export file (streamed; re-authorized now)',
    description:
      '409 EXPORT_NOT_READY while queued or running; 410 EXPORT_CANCELLED / EXPORT_FAILED / EXPORT_EXPIRED. ' +
      'Header `X-Content-SHA256` = the job’s contentHash. Audited.',
  })
  async download(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { job, stream } = await this.reads.download(ctx, id);
    res.setHeader('X-Content-SHA256', job.contentHash ?? '');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const pdf = job.format === 'pdf';
    return new StreamableFile(stream, {
      type: pdf ? 'application/pdf' : 'text/csv; charset=utf-8',
      disposition: `attachment; filename="proact-${job.reportType}-${job.id}.${job.format}"`,
      length: job.sizeBytes ?? undefined,
    });
  }
}
