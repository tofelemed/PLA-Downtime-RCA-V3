import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
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
import { WorkOrderOperation } from '../../reliability/entities/work-order-operation.entity';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { toIso } from './reliability-v2-common';
import { WORK_ORDER_WRITERS } from './reliability-roles';
import {
  WorkOrderOperationListQueryDto,
  WorkOrderOperationsImportDto,
} from './work-order-operations-v2.dto';
import {
  WorkOrderImportV2View,
  WorkOrderOperationsV2Service,
} from './work-order-operations-v2.service';

export interface WorkOrderOperationV2View {
  id: string;
  workOrderId: string;
  operationId: string;
  unitId: string;
  assetId: string | null;
  eventId: string | null;
  kind: WorkOrderOperation['operationKind'];
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  waitingSeconds: number;
  waitingReason: string | null;
  source: string;
}

const toView = (o: WorkOrderOperation): WorkOrderOperationV2View => ({
  id: o.id,
  workOrderId: o.workOrderId,
  operationId: o.operationId,
  unitId: o.unitId,
  assetId: o.assetId,
  eventId: o.eventId,
  kind: o.operationKind,
  description: o.description,
  startedAt: o.startedAt.toISOString(),
  endedAt: toIso(o.endedAt),
  waitingSeconds: o.waitingSeconds,
  waitingReason: o.waitingReason,
  source: o.source,
});

/** CMMS work-order operations, the evidence of mean active repair time (SME D10). */
@ApiTags('v2 · Work-order operations')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'work-order-operations', version: '2' })
export class WorkOrderOperationsV2Controller {
  constructor(private readonly operations: WorkOrderOperationsV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'Operations of the caller scope (keyset on startedAt; from / to overlap, eventIds, assetIds)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: WorkOrderOperationListQueryDto,
  ): Promise<ListResponse<WorkOrderOperationV2View>> {
    const page = await this.operations.list(ctx, query);
    return listResponse(page.items.map(toView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
    });
  }

  @Post('import')
  @HttpCode(200)
  @Idempotent()
  @Roles(...WORK_ORDER_WRITERS)
  @ApiOperation({
    summary:
      'Map and import CMMS work-order operations (upsert on work order + operation, all or nothing)',
    description:
      'Requires `Idempotency-Key`. Operation start / end / waiting are the actual operation times — never the ' +
      'work-order creation or closure. A row without eventId is linked to the stop of its asset running at the ' +
      'operation start. Diagnosis, repair and test operations of a stop give its active repair time (KPI ' +
      '`mttr`, "Mean active repair time"); the stop gives the mean time to restore production. 422 ' +
      'WORK_ORDER_IMPORT_INVALID lists the row problems (`details.errors`).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  importOperations(
    @Ctx() ctx: RequestContext,
    @Body() body: WorkOrderOperationsImportDto,
  ): Promise<WorkOrderImportV2View> {
    return this.operations.import(ctx, body);
  }
}
