import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'Health check status' })
  async check() {
    return this.healthService.check();
  }

  @Get('detailed')
  @ApiResponse({ status: 200, description: 'Detailed health check status' })
  async detailedCheck() {
    return this.healthService.detailedCheck();
  }
} 