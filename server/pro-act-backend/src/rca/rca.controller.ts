import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { RCAService } from './rca.service';
import { RCA } from './rca.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantBound } from '../auth/decorators/tenant-bound.decorator';
import { CreateRcaDto } from './dto/create-rca.dto';
import { UpdateRcaDto } from './dto/update-rca.dto';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';
import { findOrThrow } from '../common/helpers/find-or-throw';

@ApiTags('RCAs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@TenantBound({ fill: false })
@Controller('rcas')
export class RCAController {
  constructor(private readonly rcaService: RCAService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('teamLeadId') teamLeadId?: string,
    @Query('eventId') eventId?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<RCA[]> {
    if (tenantId) {
      return this.rcaService.findByTenant(tenantId);
    }
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
  findOne(@Param('id') id: string): Promise<RCA> {
    return findOrThrow(this.rcaService.findOne(id), 'RCA', id);
  }

  @Post()
  @ApiBody({ type: CreateRcaDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Ctx() ctx: RequestContext, @Body() data: CreateRcaDto): Promise<RCA> {
    // the tenant comes from identity (plan 3.9: the v1 screen no longer sends tenantId)
    return this.rcaService.create({ ...data, tenantId: ctx.tenantId ?? undefined });
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