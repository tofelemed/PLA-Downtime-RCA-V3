import { ReadOnlyAllowed } from '../auth/decorators/read-only-allowed.decorator';
import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipAudit } from './skip-audit.decorator';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List audit logs with optional filters', type: [AuditLog] })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AuditLog[]> {
    const hasFilters = tenantId || userId || entityType || entityId || action || startDate || endDate;
    if (!hasFilters) {
      return this.auditLogService.findAll();
    }
    return this.auditLogService.findWithFilters({
      tenantId,
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 500,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get audit log by ID', type: AuditLog })
  findOne(@Param('id') id: string): Promise<AuditLog | null> {
    return this.auditLogService.findOne(id);
  }

  @ReadOnlyAllowed()
  @Post()
  @SkipAudit()
  @ApiBody({ type: CreateAuditLogDto })
  @ApiResponse({ status: 201, description: 'Create audit log', type: AuditLog })
  create(
    @Ctx() ctx: RequestContext,
    @Body() data: CreateAuditLogDto,
  ): Promise<AuditLog> {
    if (!ctx.userId) {
      throw new ForbiddenException('Audit entries require an authenticated caller');
    }
    // Identity fields come from the token, never from the body (WF05)
    return this.auditLogService.create({
      ...data,
      userId: ctx.userId,
      tenantId: ctx.tenantId ?? undefined,
      organizationId: ctx.organizationId ?? undefined,
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
    });
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update audit log (SuperAdmin only — audit is append-only by design)' })
  @ApiBody({ type: UpdateAuditLogDto })
  @ApiResponse({ status: 200, description: 'Update audit log', type: AuditLog })
  update(@Param('id') id: string, @Body() data: UpdateAuditLogDto): Promise<AuditLog | null> {
    return this.auditLogService.update(id, data as Partial<AuditLog>);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete audit log (SuperAdmin only — audit is append-only by design)' })
  @ApiResponse({ status: 200, description: 'Delete audit log' })
  remove(@Param('id') id: string): Promise<void> {
    return this.auditLogService.remove(id);
  }
}
