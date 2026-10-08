import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { PIProxyRequestDto } from './dto/pi-proxy-request.dto';
import { PIProxyTargetDto } from './dto/pi-proxy-target.dto';
import { PIProxyResponse, PIProxyService } from './pi-proxy.service';

@ApiTags('PI Proxy')
@ApiBearerAuth()
@Controller('pi-proxy')
export class PIProxyController {
  constructor(private readonly proxyService: PIProxyService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Forward a request to the tenant PI Web API (allowlisted hosts, paths and methods only)',
  })
  proxyRequest(
    @Ctx() ctx: RequestContext,
    @Body() request: PIProxyRequestDto,
  ): Promise<PIProxyResponse> {
    return this.proxyService.forward(requireTenantId(ctx), request);
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test one of the tenant PI connections' })
  testConnection(@Ctx() ctx: RequestContext, @Body() target: PIProxyTargetDto) {
    return this.proxyService.testConnection(requireTenantId(ctx), target);
  }
}
