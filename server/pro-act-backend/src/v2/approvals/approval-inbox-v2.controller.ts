import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  ApprovalItemView,
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
  @Get(':kind/:id')
  @ApiOperation({
    summary:
      'One pending record of the inbox (approval detail): same role, scope and separation-of-duties actions as the list; 404 once decided or outside the caller’s approval scope.',
  })
  @ApiOkResponse({ type: ApprovalItemView })
  get(
    @Ctx() context: RequestContext,
    @Param('kind') kind: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApprovalItemView> {
    return this.inbox.get(context, kind, id);
  }
}
