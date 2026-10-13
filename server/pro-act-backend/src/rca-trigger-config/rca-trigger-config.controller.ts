import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { RCATriggerConfigService } from './rca-trigger-config.service';
import { CreateRCATriggerConfigDto } from './dto/create-rca-trigger-config.dto';
import { UpdateRCATriggerConfigDto } from './dto/update-rca-trigger-config.dto';
import { RCATriggerConfig } from './rca-trigger-config.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('RCA Trigger Configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-trigger-configs')
export class RCATriggerConfigController {
  constructor(
    private readonly rcaTriggerConfigService: RCATriggerConfigService,
  ) {}

  @Roles('manager_approver')
  @Post()
  @ApiOperation({ summary: 'Create RCA trigger configuration' })
  @ApiBody({ type: CreateRCATriggerConfigDto })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
    type: RCATriggerConfig,
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // All fields are now in the DTO, so we can be strict
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  create(
    @Body() createDto: CreateRCATriggerConfigDto,
  ): Promise<RCATriggerConfig> {
    return this.rcaTriggerConfigService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all RCA trigger configurations' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Return all configurations',
    type: [RCATriggerConfig],
  })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<RCATriggerConfig[]> {
    const normalizedIsActive =
      isActive === undefined
        ? undefined
        : String(isActive).toLowerCase() === 'true';
    return this.rcaTriggerConfigService.findAll({
      tenantId,
      organizationId,
      isActive: normalizedIsActive,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RCA trigger configuration by ID' })
  @ApiResponse({
    status: 200,
    description: 'Return configuration',
    type: RCATriggerConfig,
  })
  findOne(@Param('id') id: string): Promise<RCATriggerConfig> {
    return this.rcaTriggerConfigService.findOne(id);
  }

  @Roles('manager_approver')
  @Patch(':id')
  @ApiOperation({ summary: 'Update RCA trigger configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
    type: RCATriggerConfig,
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRCATriggerConfigDto,
  ): Promise<RCATriggerConfig> {
    return this.rcaTriggerConfigService.update(id, updateDto);
  }

  @Roles('manager_approver')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete RCA trigger configuration' })
  @ApiResponse({
    status: 204,
    description: 'Configuration deleted successfully',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.rcaTriggerConfigService.remove(id);
  }
}
