import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  QUEUE_WINDOW_DAYS,
  QueueRow,
  QueueTask,
  ReconciliationQueueService,
} from '../../close/reconciliation-queue.service';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import { ListResponse, listResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';

export class ReconciliationQueueQueryDto {
  @ApiPropertyOptional({ description: 'nextCursor of the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

/** One period of "My queue": what the caller should do, when it is due and whether it escalated. */
export interface QueueItemV2View {
  periodId: string;
  unitId: string;
  unitName: string | null;
  /** plan of the period's plan version (Plan Dashboard deep link), null without a plan */
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  workflowState: string;
  revision: number | null;
  task: QueueTask;
  dueAt: string;
  overdue: boolean;
  escalationLevel: number;
  escalatedTo: string | null;
  onHold: boolean;
  rejections: number;
  rejectionEscalated: boolean;
}

function toItem(
  row: QueueRow,
  roles: Array<{ role: string }>,
): QueueItemV2View {
  return {
    periodId: row.id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    planId: row.plan_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    utcStart: new Date(row.utc_start).toISOString(),
    utcEnd: new Date(row.utc_end).toISOString(),
    workflowState: row.workflow,
    revision: row.revision,
    task: row.task,
    dueAt: new Date(row.due).toISOString(),
    overdue: row.overdue,
    escalationLevel: row.escalation_level,
    escalatedTo:
      row.escalation_level > 0
        ? (roles[row.escalation_level - 1]?.role ?? null)
        : null,
    onHold: row.on_hold,
    rejections: row.rejections,
    rejectionEscalated: row.rejection_escalated,
  };
}

/** "My queue" of the reconciliation workflow (SME R3 / R6, phase R-C). */
@ApiTags('v2 · Reconciliation SLA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reconciliation-queue', version: '2' })
export class ReconciliationQueueV2Controller {
  constructor(private readonly queue: ReconciliationQueueService) {}

  @Get()
  @ApiOperation({
    summary:
      'Periods the caller should act on: prepare, review (not their own submission) or escalated to one of their roles',
    description: `Ended, not approved periods of the last ${QUEUE_WINDOW_DAYS} operational days in the caller's unit scope, earliest due first (keyset on due time). Due, overdue and escalation follow the plant's reconciliation_sla policy; time waiting for data is not counted.`,
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: ReconciliationQueueQueryDto,
  ): Promise<ListResponse<QueueItemV2View>> {
    const page = await this.queue.page(ctx, query);
    const tenantId = requireTenantId(ctx);
    const units = restrictedUnitIds(ctx, tenantId);
    return listResponse(
      page.rows.map((row) => toItem(row, page.policy.escalations)),
      page.nextCursor,
      { tenantId, ...(units ? { unitIds: units } : {}) },
      page.asOf,
    );
  }
}
