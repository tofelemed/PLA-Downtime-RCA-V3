import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PIEventService } from './pi-event.service';
import { CreatePIEventDto } from './dto/create-pi-event.dto';
import { UpdatePIEventDto } from './dto/update-pi-event.dto';
import { PIEvent } from './pi-event.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PI Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-events')
export class PIEventController {
  constructor(private readonly piEventService: PIEventService) {}

  @Post()
  @ApiOperation({ summary: 'Create PI event' })
  @ApiResponse({ status: 201, description: 'Event created successfully', type: PIEvent })
  create(@Body() createDto: CreatePIEventDto): Promise<PIEvent> {
    return this.piEventService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all PI events' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'template', required: false })
  @ApiQuery({ name: 'primaryAfId', required: false })
  @ApiQuery({ name: 'startUtc', required: false })
  @ApiQuery({ name: 'webId', required: false })
  @ApiResponse({ status: 200, description: 'Return all events', type: [PIEvent] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('template') template?: string,
    @Query('primaryAfId') primaryAfId?: string,
    @Query('startUtc') startUtc?: string,
    @Query('webId') webId?: string,
  ): Promise<PIEvent[]> {
    return this.piEventService.findAll({ tenantId, organizationId, template, primaryAfId, startUtc, webId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PI event by ID' })
  @ApiResponse({ status: 200, description: 'Return event', type: PIEvent })
  findOne(@Param('id') id: string): Promise<PIEvent> {
    return this.piEventService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PI event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully', type: PIEvent })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePIEventDto,
  ): Promise<PIEvent> {
    return this.piEventService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PI event' })
  @ApiResponse({ status: 204, description: 'Event deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.piEventService.remove(id);
  }
}

