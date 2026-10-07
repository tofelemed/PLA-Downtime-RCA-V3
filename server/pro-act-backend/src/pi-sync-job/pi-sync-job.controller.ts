import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PISyncJobService } from './pi-sync-job.service';
import { PISyncSchedulerService } from './pi-sync-scheduler.service';
import { CreatePISyncJobDto } from './dto/create-pi-sync-job.dto';
import { UpdatePISyncJobDto } from './dto/update-pi-sync-job.dto';
import { PISyncJob } from './pi-sync-job.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PI Sync Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-sync-jobs')
export class PISyncJobController {
  constructor(
    private readonly piSyncJobService: PISyncJobService,
    private readonly piSyncSchedulerService: PISyncSchedulerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create PI sync job' })
  @ApiResponse({ status: 201, description: 'Job created successfully', type: PISyncJob })
  create(@Body() createDto: CreatePISyncJobDto): Promise<PISyncJob> {
    return this.piSyncJobService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all PI sync jobs' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Return all jobs', type: [PISyncJob] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
  ): Promise<PISyncJob[]> {
    return this.piSyncJobService.findAll({ tenantId, organizationId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PI sync job by ID' })
  @ApiResponse({ status: 200, description: 'Return job', type: PISyncJob })
  findOne(@Param('id') id: string): Promise<PISyncJob> {
    return this.piSyncJobService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PI sync job' })
  @ApiResponse({ status: 200, description: 'Job updated successfully', type: PISyncJob })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePISyncJobDto,
  ): Promise<PISyncJob> {
    return this.piSyncJobService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PI sync job' })
  @ApiResponse({ status: 204, description: 'Job deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.piSyncJobService.remove(id);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Run PI sync job immediately' })
  async runNow(@Param('id') id: string) {
    const job = await this.piSyncJobService.findOne(id);
    await this.piSyncSchedulerService.runJob(job);
    return { success: true, message: 'PI sync job executed' };
  }
}

