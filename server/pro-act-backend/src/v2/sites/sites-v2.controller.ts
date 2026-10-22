import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { SiteV2ChangeDto, SiteV2CreateDto } from './site-v2.dto';
import { SiteV2View } from './site-v2.view';
import { SITE_WRITERS } from './site-writers';
import { SitesV2Service } from './sites-v2.service';

/**
 * Site writes of the acting plant (Setup UX: the plant's site list and the unit form's Site selector). The
 * reads `GET /v2/sites` and `GET /v2/sites/{id}` stay on `CalendarScheduleV2Controller` (same paths).
 */
@ApiTags('v2 · Sites')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'sites', version: '2' })
export class SitesV2Controller {
  constructor(private readonly sites: SitesV2Service) {}

  @Post()
  @Idempotent()
  @Roles(...SITE_WRITERS)
  @ApiOperation({
    summary: 'Create a site in the acting plant',
    description:
      'Requires `Idempotency-Key`. Super administrators, plant administrators, or the administrator of the ' +
      'plant’s organization (403 ORGANIZATION_NOT_ALLOWED). `timezone` defaults to the plant’s, ' +
      '`operationalDayStart` to the default site’s. 409 SITE_NAME_EXISTS (case-insensitive).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: SiteV2CreateDto,
  ): Promise<SiteV2View> {
    return this.sites.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...SITE_WRITERS)
  @ApiOperation({
    summary: 'Rename a site',
    description:
      'Same callers as create. 404 for a site outside the acting plant; 409 SITE_NAME_EXISTS.',
  })
  rename(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SiteV2ChangeDto,
  ): Promise<SiteV2View> {
    return this.sites.rename(ctx, id, body);
  }
}
