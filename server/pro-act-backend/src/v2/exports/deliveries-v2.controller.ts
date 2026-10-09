import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import {
  DeliveryReceipt,
  DeliveryReconciliationService,
} from '../../exports/delivery-reconciliation.service';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { DeliveryReconciliationQueryDto } from './export-v2.dto';

/**
 * Downstream delivery of approved results (plan 2.9, WF03, D12). R1 delivers through the outbox only
 * (in-process bus until the Kafka transport of plan 1.9); no external webhook or CMMS target is configured.
 */
@ApiTags('v2 · Exports')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'deliveries', version: '2' })
export class DeliveriesV2Controller {
  constructor(private readonly deliveries: DeliveryReconciliationService) {}

  @Get('reconciliation')
  @ApiOperation({
    summary:
      'Approved revisions vs the delivery of their PeriodApproved message',
    description:
      'Every revision approved in [from, to) with its outbox delivery: delivered, pending (retrying with backoff), ' +
      'dead (dead-lettered) or missing; unit-scoped; keyset paging.',
  })
  async reconciliation(
    @Ctx() ctx: RequestContext,
    @Query() query: DeliveryReconciliationQueryDto,
  ): Promise<ListResponse<DeliveryReceipt>> {
    const page = await this.deliveries.list(ctx, query);
    const tenantId = requireTenantId(ctx);
    const unitIds = restrictedUnitIds(ctx, tenantId);
    return listResponse(
      page.items,
      page.nextCursor,
      unitIds ? { tenantId, unitIds } : { tenantId },
    );
  }
}
