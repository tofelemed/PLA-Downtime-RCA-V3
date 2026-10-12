import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { USER_READERS, USER_WRITERS } from '../administration-roles';
import { UserDirectoryService } from './user-directory.service';
import {
  CreateUserV2Dto,
  UpdateUserV2Dto,
  UserDirectoryQueryDto,
  UsersListQueryDto,
} from './users-v2.dto';
import { UsersV2CommandsService } from './users-v2-commands.service';
import { UsersV2Service } from './users-v2.service';
import {
  GrantableRolesView,
  UserDirectoryEntry,
  UserV2View,
} from './user-v2.view';

const RULES =
  'Rank rule: a role at most your own; only users ranked strictly below you (and within your plant, or ' +
  'your organization for an organization administrator) can be edited, deactivated or deleted ' +
  '(403 ROLE_GRANT_NOT_ALLOWED / TENANT_NOT_ALLOWED / ORGANIZATION_NOT_ALLOWED).';

/** Users of the acting plant (owner requirement "v2 only": replaces the v1 `/users` screens). */
@ApiTags('v2 · Users')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {
  constructor(
    private readonly reads: UsersV2Service,
    private readonly commands: UsersV2CommandsService,
    private readonly directory: UserDirectoryService,
  ) {}

  @Get()
  @Roles(...USER_READERS)
  @ApiOperation({
    summary: 'Members of the acting plant (keyset by name or creation time)',
    description:
      'Home plant or a scope grant in the plant; organization-level users too for organization and super ' +
      'administrators. Filters: q (name, e-mail), roles, isActive. `manageable` says whether you may change the user.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: UsersListQueryDto,
  ): Promise<ListResponse<UserV2View>> {
    return this.reads.list(ctx, query);
  }

  @Get('directory')
  @ApiOperation({
    summary:
      'User names for ids, or the active members of the plant (any member)',
    description:
      'With `ids`: names of those users (inactive too) who are members of the plant or placed in no plant; ' +
      'others are left out. Without `ids`: active members by name (keyset), for assignee pickers.',
  })
  userDirectory(
    @Ctx() ctx: RequestContext,
    @Query() query: UserDirectoryQueryDto,
  ): Promise<ListResponse<UserDirectoryEntry>> {
    return this.directory.directory(ctx, query);
  }

  @Get('grantable-roles')
  @Roles(...USER_READERS)
  @ApiOperation({ summary: 'Roles you may give (at most your own rank)' })
  @ApiOkResponse({ type: GrantableRolesView })
  grantableRoles(@Ctx() ctx: RequestContext): GrantableRolesView {
    return this.reads.grantableRoles(ctx);
  }

  @Get(':id')
  @Roles(...USER_READERS)
  @ApiOperation({ summary: 'One user of your reach (404 otherwise)' })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserV2View> {
    return this.reads.get(ctx, id);
  }

  @Post()
  @Roles(...USER_WRITERS)
  @Idempotent()
  @ApiOperation({
    summary: 'Create a user (requires Idempotency-Key)',
    description: `Placed in the acting plant unless a super administrator chooses another; 409 EMAIL_EXISTS. ${RULES}`,
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateUserV2Dto,
  ): Promise<UserV2View> {
    return this.commands.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...USER_WRITERS)
  @ApiOperation({
    summary: 'Change name, e-mail, role, password or active state of a user',
    description: `422 CANNOT_DEACTIVATE_SELF for your own account. ${RULES}`,
  })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserV2Dto,
  ): Promise<UserV2View> {
    return this.commands.update(ctx, id, body);
  }

  @Delete(':id')
  @Roles(...USER_WRITERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user and its scope grants',
    description: `422 CANNOT_DELETE_SELF for your own account. ${RULES}`,
  })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.commands.remove(ctx, id);
  }
}
