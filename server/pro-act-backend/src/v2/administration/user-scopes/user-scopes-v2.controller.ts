import {
  Body,
  Controller,
  Delete,
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
import { USER_READERS, USER_WRITERS } from '../administration-roles';
import {
  GrantUserScopeDto,
  UserScopesListQueryDto,
} from './user-scopes-v2.dto';
import { UserScopeV2View } from './user-scope-v2.view';
import { UserScopesV2Service } from './user-scopes-v2.service';

const RULES =
  'SuperAdmin may manage its own supplemental grants. Other callers cannot grant or revoke their own access (403 SELF_GRANT_NOT_ALLOWED), a role above their rank or for a ' +
  'user who is not ranked below you (403 ROLE_GRANT_NOT_ALLOWED); the grant mirroring a user’s role in its ' +
  'home plant changes with the role (422 HOME_SCOPE_REQUIRED). Every grant and revoke is audited.';

/** Scope grants of the acting plant: who holds which role in the plant or in one of its units. */
@ApiTags('v2 · User scopes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'user-scopes', version: '2' })
export class UserScopesV2Controller {
  constructor(private readonly scopes: UserScopesV2Service) {}

  @Get()
  @Roles(...USER_READERS)
  @ApiOperation({
    summary: 'Scope grants in the acting plant (newest first)',
    description:
      '`lock` says why you may not revoke a grant (null when you may).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: UserScopesListQueryDto,
  ): Promise<ListResponse<UserScopeV2View>> {
    return this.scopes.list(ctx, query);
  }

  @Post()
  @Roles(...USER_WRITERS)
  @Idempotent()
  @ApiOperation({
    summary:
      'Grant a role in the plant or one of its units (requires Idempotency-Key)',
    description:
      '`userId` of a user the plant sees, or `email` (exact) of a user of the plant’s organization for a first ' +
      `grant (404 when none). 409 SCOPE_EXISTS, 422 USER_INACTIVE / INVALID_REFERENCE. ${RULES}`,
  })
  grant(
    @Ctx() ctx: RequestContext,
    @Body() body: GrantUserScopeDto,
  ): Promise<UserScopeV2View> {
    return this.scopes.grant(ctx, body);
  }

  @Delete(':id')
  @Roles(...USER_WRITERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a grant', description: RULES })
  revoke(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.scopes.revoke(ctx, id);
  }
}
