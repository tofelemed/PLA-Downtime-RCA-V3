import { MoneyFields } from '../../auth/money/money.decorators';
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
import { BulkJobView } from '../production-events/event-operation.view';
import { ProductionEventOperationsV2Service } from '../production-events/production-event-operations-v2.service';

/** Status of long-running commands (spec API04). */
@ApiTags('v2 · Jobs')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'jobs', version: '2' })
// QA re-test 2026-10-19: event views in job results carry the recorded cost (money)
@MoneyFields('cost')
export class JobsV2Controller {
  constructor(
    private readonly operations: ProductionEventOperationsV2Service,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Status of a job of the caller tenant',
    description:
      'state queued → running → completed | partial | failed; `chunks` lists each atomic chunk with its ' +
      'outcome and error code. A foreign or unknown id is 404.',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<BulkJobView> {
    return this.operations.job(ctx, id);
  }
}
