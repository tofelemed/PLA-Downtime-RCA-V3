import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all organizations', type: [Organization] })
  findAll(): Promise<Organization[]> {
    return this.organizationService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get organization by ID', type: Organization })
  findOne(@Param('id') id: string): Promise<Organization | null> {
    return this.organizationService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateOrganizationDto })
  @ApiResponse({ status: 201, description: 'Create organization', type: Organization })
  create(@Body() data: CreateOrganizationDto): Promise<Organization> {
    return this.organizationService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiResponse({ status: 200, description: 'Update organization', type: Organization })
  update(@Param('id') id: string, @Body() data: UpdateOrganizationDto): Promise<Organization | null> {
    return this.organizationService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete organization' })
  remove(@Param('id') id: string): Promise<void> {
    return this.organizationService.remove(id);
  }
} 