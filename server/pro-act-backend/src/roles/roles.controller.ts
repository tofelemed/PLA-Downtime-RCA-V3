import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from './role.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/** Role catalogue: administrators and approvers read it; only a SuperAdmin changes it. */
@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'manager_approver')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all roles', type: [Role] })
  async findAll(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get role by ID', type: Role })
  async findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Roles('SuperAdmin')
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({ status: 201, description: 'Create role', type: Role })
  async create(@Body() data: CreateRoleDto): Promise<Role> {
    return this.rolesService.create(data);
  }

  @Put(':id')
  @Roles('SuperAdmin')
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ status: 200, description: 'Update role', type: Role })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateRoleDto,
  ): Promise<Role> {
    return this.rolesService.update(id, data);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @ApiResponse({ status: 200, description: 'Delete role', type: Object })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.rolesService.remove(id);
    return { success: true };
  }
}
