import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  resolveRequestTenantId,
  TENANT_SELECTION_HEADER,
} from '../auth/request-tenant';
import { PIProxyRequestDto } from './dto/pi-proxy-request.dto';
import { PIProxyTargetDto } from './dto/pi-proxy-target.dto';
import { PIProxyResponse, PIProxyService } from './pi-proxy.service';

@ApiTags('PI Proxy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    @CurrentUser() user: AuthenticatedUser,
    @Headers(TENANT_SELECTION_HEADER) tenantHeader: string | undefined,
    @Body() request: PIProxyRequestDto,
  ): Promise<PIProxyResponse> {
    return this.proxyService.forward(
      resolveRequestTenantId(user, tenantHeader),
      request,
    );
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test one of the tenant PI connections' })
  testConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Headers(TENANT_SELECTION_HEADER) tenantHeader: string | undefined,
    @Body() target: PIProxyTargetDto,
  ) {
    return this.proxyService.testConnection(
      resolveRequestTenantId(user, tenantHeader),
      target,
    );
  }
}
