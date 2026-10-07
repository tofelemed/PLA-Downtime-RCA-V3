import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all users', type: [User] })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<User[]> {
    const normalizedIsActive =
      isActive === undefined
        ? undefined
        : String(isActive).toLowerCase() === 'true'
          ? true
          : String(isActive).toLowerCase() === 'false'
            ? false
            : undefined;

    return this.usersService.findAll({
      tenantId,
      organizationId,
      isActive: normalizedIsActive,
    });
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get user by ID', type: User })
  async findOne(@Param('id') id: string): Promise<User | undefined> {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'Create user', type: User })
  async create(@Body() body: CreateUserDto): Promise<User> {
    return this.usersService.create(body);
  }

  @Put(':id')
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'Update user', type: User })
  async update(@Param('id') id: string, @Body() body: UpdateUserDto): Promise<User | undefined> {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete user' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
} 