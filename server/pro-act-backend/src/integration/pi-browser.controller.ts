import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PIWebApiService } from './pi-web-api.service';
import { PIEventPullService } from './pi-event-pull.service';

class PIBrowserRequestDto {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | boolean>;
  data?: any;
}

@ApiTags('PI Browser')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-browser')
export class PIBrowserController {
  constructor(
    private readonly piWebApiService: PIWebApiService,
    private readonly piEventPullService: PIEventPullService,
  ) {}

  @Get(':tenantId/test-connection')
  @ApiOperation({ summary: 'Test PI connection using stored credentials' })
  async testConnection(@Param('tenantId') tenantId: string) {
    return this.piWebApiService.testConnection(tenantId);
  }

  @Post(':tenantId/request')
  @ApiOperation({ summary: 'Proxy a PI Web API request using stored tenant credentials' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async proxyRequest(@Param('tenantId') tenantId: string, @Body() body: PIBrowserRequestDto) {
    if (!body.path) {
      return { error: 'path is required' };
    }
    return this.piWebApiService.request(tenantId, body.path, {
      method: body.method || 'GET',
      params: body.params,
      data: body.data,
    });
  }

  @Get(':tenantId/eventframes')
  @ApiOperation({ summary: 'Fetch PI event frames for tenant scope' })
  @ApiQuery({ name: 'scopeType', required: false })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiQuery({ name: 'startTimeUtc', required: true })
  @ApiQuery({ name: 'endTimeUtc', required: true })
  @ApiQuery({ name: 'templateName', required: false })
  @ApiQuery({ name: 'maxCount', required: false })
  @ApiQuery({ name: 'startIndex', required: false })
  async getEventFrames(
    @Param('tenantId') tenantId: string,
    @Query('scopeType') scopeType?: 'database' | 'element',
    @Query('scopeId') scopeId?: string,
    @Query('startTimeUtc') startTimeUtc?: string,
    @Query('endTimeUtc') endTimeUtc?: string,
    @Query('templateName') templateName?: string,
    @Query('maxCount') maxCount?: string,
    @Query('startIndex') startIndex?: string,
  ) {
    return this.piWebApiService.getEventFrames(tenantId, {
      scopeType,
      scopeId,
      startTimeUtc: startTimeUtc || new Date(Date.now() - 3600 * 1000).toISOString(),
      endTimeUtc: endTimeUtc || new Date().toISOString(),
      templateName,
      maxCount: maxCount ? parseInt(maxCount, 10) : 200,
      startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
    });
  }

  @Post(':tenantId/sync')
  @ApiOperation({ summary: 'Trigger PI event sync for tenant (uses watermarks for delta sync)' })
  async triggerSync(
    @Param('tenantId') tenantId: string,
    @Body()
    body?: {
      startTimeUtc?: string;
      endTimeUtc?: string;
      scopeType?: 'database' | 'element';
      scopeId?: string;
      templateName?: string;
      maxCount?: number;
      autoCreateProductionEvents?: boolean;
    },
  ) {
    return this.piEventPullService.pullEvents({
      tenantId,
      ...body,
    });
  }
}
