import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getRepository } from 'typeorm';
import { OEESummary } from '../oee-summary/oee-summary.entity';
import { ProductionLoss } from '../production-loss/production-loss.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { RCA } from '../rca/rca.entity';
import { Task } from '../task/task.entity';

@ApiTags('Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportingController {
  @Get('oee-summary')
  @ApiOperation({ summary: 'Get OEE summary report (stub)' })
  @ApiQuery({ name: 'tenantId', required: false })
  getOeeSummary(@Query('tenantId') tenantId?: string) {
    // TODO: Implement real report logic
    return {
      message: 'OEE summary report not implemented yet',
      tenantId,
      data: [],
    };
  }

  @Get('production-loss')
  @ApiOperation({ summary: 'Get production loss report (stub)' })
  @ApiQuery({ name: 'tenantId', required: false })
  getProductionLoss(@Query('tenantId') tenantId?: string) {
    // TODO: Implement real report logic
    return {
      message: 'Production loss report not implemented yet',
      tenantId,
      data: [],
    };
  }

  @Get('oee-trends')
  @ApiOperation({ summary: 'Get OEE trends report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'OEE trends data', type: [OEESummary] })
  async getOeeTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const repo = getRepository(OEESummary);
    const qb = repo.createQueryBuilder('oee')
      .where('oee.createdAt >= :startDate AND oee.createdAt <= :endDate', { startDate, endDate });
    if (tenantId) qb.andWhere('oee.tenantId = :tenantId', { tenantId });
    const data = await qb.getMany();
    return { data };
  }

  @Get('loss-analysis')
  @ApiOperation({ summary: 'Get loss analysis report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Loss analysis data', type: [ProductionLoss] })
  async getLossAnalysis(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const repo = getRepository(ProductionLoss);
    const qb = repo.createQueryBuilder('loss')
      .where('loss.createdAt >= :startDate AND loss.createdAt <= :endDate', { startDate, endDate });
    if (tenantId) qb.andWhere('loss.tenantId = :tenantId', { tenantId });
    const data = await qb.getMany();
    return { data };
  }

  @Get('audit-trail')
  @ApiOperation({ summary: 'Get audit trail report' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Audit trail data', type: [AuditLog] })
  async getAuditTrail(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
  ) {
    const repo = getRepository(AuditLog);
    const qb = repo.createQueryBuilder('log');
    if (startDate && endDate) {
      qb.where('log.createdAt >= :startDate AND log.createdAt <= :endDate', { startDate, endDate });
    }
    if (userId) qb.andWhere('log.userId = :userId', { userId });
    const data = await qb.getMany();
    return { data };
  }

  @Get('rca-summary')
  @ApiOperation({ summary: 'Get RCA summary report' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'RCA summary data', type: [RCA] })
  async getRcaSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const repo = getRepository(RCA);
    const qb = repo.createQueryBuilder('rca');
    if (startDate && endDate) {
      qb.where('rca.createdAt >= :startDate AND rca.createdAt <= :endDate', { startDate, endDate });
    }
    if (tenantId) qb.andWhere('rca.tenantId = :tenantId', { tenantId });
    const data = await qb.getMany();
    return { data };
  }

  @Get('task-summary')
  @ApiOperation({ summary: 'Get Task summary report' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Task summary data', type: [Task] })
  async getTaskSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const repo = getRepository(Task);
    const qb = repo.createQueryBuilder('task');
    if (startDate && endDate) {
      qb.where('task.createdAt >= :startDate AND task.createdAt <= :endDate', { startDate, endDate });
    }
    if (tenantId) qb.andWhere('task.tenantId = :tenantId', { tenantId });
    const data = await qb.getMany();
    return { data };
  }
} 