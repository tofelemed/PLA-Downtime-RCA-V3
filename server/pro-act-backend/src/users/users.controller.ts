import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnyRole, Roles } from '../auth/decorators/roles.decorator';
import {
  assertCallerMayGrant,
  assertCallerMayManage,
  assertCallerMayPlace,
  assertCallerMayRegister,
} from '../auth/roles/grant-policy';
import { Ctx } from '../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { AssignableUserDto, toPublicUser, UserPublicView } from './user-public';

/**
 * v1 user administration. Reads are for administrators and approvers; writes for administrators,
 * who may not grant a role above their own rank nor reach outside their tenant / organization
 * (`grant-policy.ts`). `GET /users/assignable` is the one list every member may read.
 * The password hash never leaves the service boundary (`toPublicUser`).
 */
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'manager_approver')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('assignable')
  @AnyRole()
  @ApiResponse({
    status: 200,
    description:
      'Active users of the acting tenant (id and name), for assignee pickers',
    type: [AssignableUserDto],
  })
  async findAssignable(
    @Ctx() ctx: RequestContext,
  ): Promise<AssignableUserDto[]> {
    return this.usersService.findAssignable(requireTenantId(ctx));
  }

  @Get()
  @ApiResponse({ status: 200, description: 'List all users' })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<UserPublicView[]> {
    const users = await this.usersService.findAll({
      tenantId,
      organizationId,
      isActive: parseBoolean(isActive),
    });
    return users.map(toPublicUser);
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get user by ID' })
  async findOne(@Param('id') id: string): Promise<UserPublicView | undefined> {
    const user = await this.usersService.findById(id);
    return user ? toPublicUser(user) : undefined;
  }

  @Post()
  @Roles('SuperAdmin', 'OrgAdmin', 'TenantAdmin')
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'Create user' })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateUserDto,
  ): Promise<UserPublicView> {
    const placed = ctx.isSuperAdmin
      ? body
      : {
          ...body,
          tenantId: body.tenantId ?? ctx.tenantId ?? undefined,
          organizationId:
            body.organizationId ?? ctx.organizationId ?? undefined,
        };
    assertCallerMayRegister(ctx, placed);
    return toPublicUser(await this.usersService.create(placed));
  }

  @Put(':id')
  @Roles('SuperAdmin', 'OrgAdmin', 'TenantAdmin')
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'Update user' })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserPublicView | undefined> {
    const target = await this.manageable(ctx, id);
    // A role change is a grant (at most the caller's own rank); a move is a placement
    if (body.role && body.role !== target.role) {
      assertCallerMayGrant(ctx, body.role);
    }
    assertCallerMayPlace(ctx, body);
    const updated = await this.usersService.update(id, body);
    return updated ? toPublicUser(updated) : undefined;
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'OrgAdmin', 'TenantAdmin')
  @ApiResponse({ status: 200, description: 'Delete user' })
  async remove(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.manageable(ctx, id);
    return this.usersService.remove(id);
  }

  /** The target user as stored, after the caller's rank and reach have been checked against it. */
  private async manageable(
    ctx: RequestContext,
    id: string,
  ): Promise<UserPublicView> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    assertCallerMayManage(ctx, user);
    return toPublicUser(user);
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const lower = String(value).toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return undefined;
}
