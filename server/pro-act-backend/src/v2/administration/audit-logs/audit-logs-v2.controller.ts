import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AUDIT_READERS } from '../../../audit-log/audit-roles';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { auditCsv } from './audit-csv';
import { AuditEntryV2View, AuditSummaryView } from './audit-entry-v2.view';
import { AuditFiltersDto, AuditListQueryDto } from './audit-logs-v2.dto';
import {
  AUDIT_EXPORT_MAX_ROWS,
  AuditLogsV2Service,
} from './audit-logs-v2.service';

/** The acting plant's audit trail (administrators and approvers, `AUDIT_READERS`). Read-only. */
@ApiTags('v2 · Audit logs')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Roles(...AUDIT_READERS)
@Controller({ path: 'audit-logs', version: '2' })
export class AuditLogsV2Controller {
  constructor(private readonly audit: AuditLogsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'Audit entries of the acting plant (newest first, keyset)',
    description:
      'Filters: from/to (entry time, half-open; from ≥ to is 422 INVALID_RANGE), actions, entityTypes, userIds, ' +
      'entityId, q (action, entity type, details). Actor names are resolved on the server.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: AuditListQueryDto,
  ): Promise<ListResponse<AuditEntryV2View>> {
    return this.audit.list(ctx, query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Counts of the filtered entries: total, by action, by entity type, by UTC day',
  })
  @ApiOkResponse({ type: AuditSummaryView })
  summary(
    @Ctx() ctx: RequestContext,
    @Query() query: AuditFiltersDto,
  ): Promise<AuditSummaryView> {
    return this.audit.summary(ctx, query);
  }

  @Get('export')
  @ApiOperation({
    summary: `CSV of the filtered entries (newest first, at most ${AUDIT_EXPORT_MAX_ROWS} rows)`,
    description:
      'Times in ISO 8601 UTC, and on the plant clock with its offset. `X-Export-Truncated: true` when more entries matched.',
  })
  @ApiProduces('text/csv')
  async export(
    @Ctx() ctx: RequestContext,
    @Query() query: AuditFiltersDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const { rows, truncated, timezone } = await this.audit.exportRows(
      ctx,
      query,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="audit-log.csv"',
    );
    response.setHeader('X-Export-Truncated', String(truncated));
    return auditCsv(rows, timezone);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One audit entry of the acting plant (404 otherwise)',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AuditEntryV2View> {
    return this.audit.get(ctx, id);
  }
}
