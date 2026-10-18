import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { EventAttributedLossesV2View } from './event-attributed-losses.view';
import {
  LossAttributionV2Service,
  MAX_ATTRIBUTED_PERIODS,
} from './loss-attribution-v2.service';

/** UX G-2(b): the loss an event carries in the periods it touched (stored lines, never recomputed). */
@ApiTags('v2 · Loss accounting')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-events', version: '2' })
export class EventAttributedLossesV2Controller {
  constructor(private readonly reads: LossAttributionV2Service) {}

  @Get(':id/attributed-losses')
  @ApiOperation({
    summary:
      'Plan-ledger loss lines whose cause is the event, per period revision: approved (published revision) and provisional (open revision run)',
    description:
      'Quantities per kind and unit of measure and the value of the tenant default valuation view per currency ' +
      '(amount null when any line is unvalued). Loss kinds only; periods of units outside the caller scope are ' +
      `left out. At most ${MAX_ATTRIBUTED_PERIODS} periods, earliest first (\`truncated\` when cut). 404 for an event ` +
      'outside the tenant or the caller scope.',
  })
  attributedLosses(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EventAttributedLossesV2View> {
    return this.reads.attributedLosses(ctx, id);
  }
}
