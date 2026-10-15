import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { DELEGATION_WRITERS } from '../administration-roles';
import {
  CreateRoleDelegationDto,
  RevokeRoleDelegationDto,
  RoleDelegationsListQueryDto,
} from './role-delegations-v2.dto';
import { RoleDelegationV2View } from './role-delegation-v2.view';
import { RoleDelegationsV2Service } from './role-delegations-v2.service';

const RULES =
  'A plant administrator records a delegation for anyone, a holder of the role for themselves (403 ' +
  'DELEGATION_NOT_ALLOWED). 422: DELEGATOR_LACKS_ROLE (the delegator holds the role on the scope on their own), ' +
  'DELEGATE_NOT_MEMBER, SELF_DELEGATION, INVALID_INTERVAL, TOO_LONG (more than 90 days), ALREADY_ENDED, INVALID_SCOPE. ' +
  'While in force the delegate holds the role like a scope grant; separation of duties applies to the delegate.';

/** SME R1 / R6: time-boxed delegations of approval roles in the acting plant. */
@ApiTags('v2 · Role delegations')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'role-delegations', version: '2' })
export class RoleDelegationsV2Controller {
  constructor(private readonly delegations: RoleDelegationsV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'Delegations of approval roles in the acting plant, newest first (keyset)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: RoleDelegationsListQueryDto,
  ): Promise<ListResponse<RoleDelegationV2View>> {
    return this.delegations.list(ctx, query);
  }

  @Post()
  @Roles(...DELEGATION_WRITERS)
  @Idempotent()
  @ApiOperation({
    summary: 'Delegate an approval role for a limited time',
    description: RULES,
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateRoleDelegationDto,
  ): Promise<RoleDelegationV2View> {
    return this.delegations.create(ctx, body);
  }

  @Post(':id/revoke')
  @Roles(...DELEGATION_WRITERS)
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'End a delegation early (the delegator, the delegate or a plant administrator)',
    description: '409 DELEGATION_OVER when it is already revoked or over.',
  })
  revoke(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RevokeRoleDelegationDto,
  ): Promise<RoleDelegationV2View> {
    return this.delegations.revoke(ctx, id, body);
  }
}
