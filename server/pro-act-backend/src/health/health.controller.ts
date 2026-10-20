import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

/** 503 with the same body when the database is unreachable, so probes (Docker, load balancer) see it. */
function statusOf(result: { status: string }, res: Response): void {
  if (result.status !== 'healthy') res.status(HttpStatus.SERVICE_UNAVAILABLE);
}

@ApiTags('Health')
// probes (load balancer, Docker, monitoring) must never be rate limited (perf audit P11)
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiResponse({ status: 200, description: 'Healthy: the database answers' })
  @ApiResponse({
    status: 503,
    description: 'Unhealthy: the database does not answer (same body)',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();
    statusOf(result, res);
    return result;
  }

  /** Host, database name, memory and runtime details: for administrators, not the public (perf audit P13). */
  @Get('detailed')
  @Roles('SuperAdmin')
  @ApiResponse({ status: 200, description: 'Detailed health check status' })
  @ApiResponse({ status: 503, description: 'The database does not answer' })
  async detailedCheck(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.detailedCheck();
    statusOf(result, res);
    return result;
  }
}
