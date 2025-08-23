import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { RCAService } from './rca.service';
import { RCA } from './rca.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRcaDto } from './dto/create-rca.dto';
import { UpdateRcaDto } from './dto/update-rca.dto';

@ApiTags('RCAs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rcas')
export class RCAController {
  constructor(private readonly rcaService: RCAService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('teamLeadId') teamLeadId?: string,
    @Query('eventId') eventId?: string,
  ): Promise<RCA[]> {
    if (status) {
      return this.rcaService.findByStatus(status);
    }
    if (priority) {
      return this.rcaService.findByPriority(priority);
    }
    if (teamLeadId) {
      return this.rcaService.findByTeamLead(teamLeadId);
    }
    if (eventId) {
      return this.rcaService.findByEvent(eventId);
    }
    return this.rcaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<RCA | null> {
    return this.rcaService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateRcaDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateRcaDto): Promise<RCA> {
    return this.rcaService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateRcaDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateRcaDto): Promise<RCA | null> {
    return this.rcaService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.rcaService.remove(id);
  }
} 