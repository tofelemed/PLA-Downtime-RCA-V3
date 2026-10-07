import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportingService } from './reporting.service';

@ApiTags('Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('oee-summary')
  @ApiOperation({ summary: 'Get OEE summary report with aggregates' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'unitId', required: false })
  getOeeSummary(
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.reportingService.getOeeSummary({ tenantId, startDate, endDate, unitId });
  }

  @Get('production-loss')
  @ApiOperation({ summary: 'Get production loss report with breakdowns' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'unitId', required: false })
  getProductionLoss(
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.reportingService.getProductionLossReport({ tenantId, startDate, endDate, unitId });
  }

  @Get('oee-trends')
  @ApiOperation({ summary: 'Get OEE trends report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getOeeTrends(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.reportingService.getOeeTrends({ tenantId, startDate, endDate });
  }

  @Get('loss-analysis')
  @ApiOperation({ summary: 'Get loss analysis report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getLossAnalysis(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.reportingService.getLossAnalysis({ tenantId, startDate, endDate });
  }

  @Get('audit-trail')
  @ApiOperation({ summary: 'Get audit trail report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getAuditTrail(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.reportingService.getAuditTrail({ tenantId, startDate, endDate, userId });
  }

  @Get('rca-summary')
  @ApiOperation({ summary: 'Get RCA summary report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getRcaSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.reportingService.getRcaSummary({ tenantId, startDate, endDate });
  }

  @Get('task-summary')
  @ApiOperation({ summary: 'Get task summary report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiResponse({ status: 200, description: 'Task summary data' })
  getTaskSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.reportingService.getTaskSummary({ tenantId, startDate, endDate });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Executive dashboard overview with KPIs and chart series' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getDashboard(
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportingService.getDashboardOverview({ tenantId, startDate, endDate });
  }
}
