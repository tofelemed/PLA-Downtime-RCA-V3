import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { LossLinePickerV2View } from './loss-line-picker';
import { LossAttributionV2Service } from './loss-attribution-v2.service';
import { LossLineListQueryDto } from './loss-lines-v2.dto';

/** UX G-3: plant-wide loss-line search for the RCA link picker. */
@ApiTags('v2 · Loss accounting')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'loss-lines', version: '2' })
export class LossLinesV2Controller {
  constructor(private readonly reads: LossAttributionV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'Loss lines of the current run of each period’s latest revision across the caller’s units, newest period first (keyset)',
    description:
      'Plan ledger, active lines, loss kinds (filter `kinds`). Filters: unitIds, reasonCodeIds, kinds, q (reason code, ' +
      'reason name, cause event description), from/to (period and line segment overlap, half-open; from ≥ to is 422 ' +
      'INVALID_RANGE). The `id` is the `targetId` of an RCA `loss_line` link.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: LossLineListQueryDto,
  ): Promise<ListResponse<LossLinePickerV2View>> {
    return this.reads.lossLines(ctx, query);
  }
}
