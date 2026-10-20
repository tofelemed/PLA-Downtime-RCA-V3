import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { SessionBootstrapV2Service } from './session-bootstrap-v2.service';
import { SessionBootstrapV2View } from './session-bootstrap-v2.view';

/** Batch read of the app shell (perf audit P08): one request instead of ~7 on every page load. */
@ApiTags('v2 · Session')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'session', version: '2' })
export class SessionBootstrapV2Controller {
  constructor(private readonly session: SessionBootstrapV2Service) {}

  @Get('bootstrap')
  @ApiOperation({
    summary: 'Everything the app shell reads on every page, in one request',
    description:
      'Branding, feature flags, unread notification count, sites (first 100), the acting plant and the ' +
      'plant directory (every organization and plant the caller may see). Each part is exactly the body ' +
      'of GET /v2/branding, /v2/feature-flags, /v2/notifications/unread-count, /v2/sites?limit=100, ' +
      '/v2/tenants/{acting tenant} and every page of /v2/organizations and /v2/tenants. Read only.',
  })
  bootstrap(@Ctx() ctx: RequestContext): Promise<SessionBootstrapV2View> {
    return this.session.bootstrap(ctx);
  }
}
