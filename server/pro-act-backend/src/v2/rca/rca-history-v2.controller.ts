import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import {
  RcaHistoryPageV2View,
  RcaHistoryService,
} from '../../rca-case/rca-history.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { RcaHistoryV2QueryDto } from './rca-history-v2.dto';

/** RCA field history (item 2): the append-only audit of a case and its child rows. */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rcas', version: '2' })
export class RcaHistoryV2Controller {
  constructor(private readonly history: RcaHistoryService) {}

  @Get(':id/history')
  @ApiOperation({
    summary: 'Field history of a case, newest first (append-only audit)',
    description:
      'Every command on the case, its actions, links, analysis tools and causes: who, when, the action, ' +
      'the changed top-level fields, small before / after values (status, owner, due date, root-cause ' +
      'length), the reason, and hashes of the row before and after. Keyset pages (cursor, limit) with ' +
      '`totalCount`, the number of entries of the case; 404 outside your tenant and units.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RcaHistoryV2QueryDto,
  ): Promise<RcaHistoryPageV2View> {
    return this.history.list(ctx, id, query);
  }
}
