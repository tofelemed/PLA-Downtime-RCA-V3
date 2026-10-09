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
import { PlanGenerationJobsService } from '../../plans/plan-generation-jobs.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PlanGenerationJobV2View, toJobView } from './plan-v2.view';

/** Status of plan period generations (API04). */
@ApiTags('v2 · Production plans')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'plan-generation-jobs', version: '2' })
export class PlanGenerationJobsV2Controller {
  constructor(private readonly jobs: PlanGenerationJobsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Status of a plan period generation',
    description:
      'state queued → running → completed | failed; `result` has the period count, totals per unit and ' +
      'warnings, `errorCode` the refusal (NO_ELIGIBLE_TIME, UNIT_SCOPE, ...). Foreign ids are 404.',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PlanGenerationJobV2View> {
    return toJobView(await this.jobs.get(ctx, id));
  }
}
