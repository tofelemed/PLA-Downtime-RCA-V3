import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all audit logs', type: [AuditLog] })
  findAll(): Promise<AuditLog[]> {
    return this.auditLogService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get audit log by ID', type: AuditLog })
  findOne(@Param('id') id: string): Promise<AuditLog | null> {
    return this.auditLogService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateAuditLogDto })
  @ApiResponse({ status: 201, description: 'Create audit log', type: AuditLog })
  create(@Body() data: CreateAuditLogDto): Promise<AuditLog> {
    return this.auditLogService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateAuditLogDto })
  @ApiResponse({ status: 200, description: 'Update audit log', type: AuditLog })
  update(@Param('id') id: string, @Body() data: UpdateAuditLogDto): Promise<AuditLog | null> {
    return this.auditLogService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete audit log' })
  remove(@Param('id') id: string): Promise<void> {
    return this.auditLogService.remove(id);
  }
} 