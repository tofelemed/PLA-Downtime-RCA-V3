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
import { IntakeQueriesV2Service } from './intake-queries-v2.service';
import { ReplayRunV2View } from './intake-v2.view';

/** Status of replay runs (API04 job status for `POST /connections/{id}/replays`). */
@ApiTags('v2 · Replay Runs')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'replay-runs', version: '2' })
export class ReplayRunsV2Controller {
  constructor(private readonly queries: IntakeQueriesV2Service) {}

  @Get(':id')
  @ApiOperation({
    summary: 'State and counts of a replay run; foreign ids are 404',
    description:
      'state queued → running → completed | failed; counts: objects, normalized, quarantined, unchanged, failed.',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ReplayRunV2View> {
    return this.queries.replayRun(ctx, id);
  }
}
