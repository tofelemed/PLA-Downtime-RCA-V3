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
import { ActualsJobsService } from '../../periods/actuals-jobs.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ActualsJobV2View, toActualsJobView } from './period-v2.view';

/** Status of actuals recomputes and report imports (API04). */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'actuals-jobs', version: '2' })
export class ActualsJobsV2Controller {
  constructor(private readonly jobs: ActualsJobsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Status of an actuals job (recompute | report_import)',
    description:
      'state queued → running → completed | failed; a recompute result has `runId` and `reused`, an import ' +
      '`imported`, `duplicates`, `stale` and `problems`; `errorCode` e.g. UNIT_SCOPE. Foreign ids are 404.',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ActualsJobV2View> {
    return toActualsJobView(await this.jobs.get(ctx, id));
  }
}
