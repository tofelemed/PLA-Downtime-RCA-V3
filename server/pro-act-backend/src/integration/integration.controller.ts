import { Controller, Post, Get, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PIEventPullService, PullEventsResponse } from './pi-event-pull.service';
import { PullEventsDto } from './dto/pull-events.dto';

@ApiTags('Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integration')
export class IntegrationController {
  constructor(private readonly piEventPullService: PIEventPullService) {}

  @Post('pi/pull-events')
  @ApiOperation({ summary: 'Pull event frames from PI system' })
  @ApiBody({ type: PullEventsDto })
  @ApiResponse({ status: 200, description: 'Events pulled successfully' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async pullEventsFromPI(@Body() pullDto: PullEventsDto): Promise<PullEventsResponse> {
    return await this.piEventPullService.pullEvents(pullDto);
  }

  @Get('pi/test-connection')
  @ApiOperation({ summary: 'Test PI connection for tenant' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testPIConnection(@Query('tenantId') tenantId: string): Promise<{ connected: boolean; message: string }> {
    return await this.piEventPullService.testConnection(tenantId);
  }

  @Post('cmms/push')
  @ApiOperation({ summary: 'Push data to CMMS system (stub)' })
  pushToCMMS(@Body() body: any) {
    // TODO: Implement real CMMS integration
    return {
      message: 'CMMS integration not implemented yet',
      request: body,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get integration status (stub)' })
  getStatus() {
    return {
      message: 'Integration status not implemented yet',
      status: 'unknown',
    };
  }
} 