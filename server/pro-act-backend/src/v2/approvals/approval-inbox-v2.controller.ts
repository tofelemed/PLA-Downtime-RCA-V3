import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ApprovalInboxService } from './approval-inbox.service';
import {
  ApprovalInboxQueryDto,
  ApprovalInboxView,
} from './approval-inbox-v2.dto';
@ApiTags('v2 · Approvals')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'approval-inbox', version: '2' })
export class ApprovalInboxV2Controller {
  constructor(private readonly inbox: ApprovalInboxService) {}
  @Get()
  @ApiOperation({
    summary:
      'Pending records for the caller’s approval roles and record scopes, oldest first. Read-only; decisions use existing domain commands.',
  })
  @ApiOkResponse({ type: ApprovalInboxView })
  list(
    @Ctx() context: RequestContext,
    @Query() query: ApprovalInboxQueryDto,
  ): Promise<ApprovalInboxView> {
    return this.inbox.list(context, query);
  }
}
