import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnmappedEventService } from './unmapped-event.service';
import { UnmappedEvent } from './unmapped-event.entity';
import { CreateUnmappedEventDto } from './dto/create-unmapped-event.dto';
import { UpdateUnmappedEventDto } from './dto/update-unmapped-event.dto';
import { findOrThrow } from '../common/helpers/find-or-throw';

@ApiTags('Unmapped Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('unmapped-events')
export class UnmappedEventController {
  constructor(private readonly eventService: UnmappedEventService) {}

  @Get()
  findAll(@Query('tenantId') tenantId?: string, @Query('unitId') unitId?: string): Promise<UnmappedEvent[]> {
    if (tenantId) return this.eventService.findByTenant(tenantId);
    if (unitId) return this.eventService.findByUnit(unitId);
    return this.eventService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<UnmappedEvent> {
    return findOrThrow(this.eventService.findOne(id), 'UnmappedEvent', id);
  }

  @Post()
  @ApiBody({ type: CreateUnmappedEventDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateUnmappedEventDto): Promise<UnmappedEvent> {
    return this.eventService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateUnmappedEventDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateUnmappedEventDto): Promise<UnmappedEvent | null> {
    return this.eventService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.eventService.remove(id);
  }
} 