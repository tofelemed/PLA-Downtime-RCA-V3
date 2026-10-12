import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { BrandingV2Dto, BrandingV2View } from './branding-v2.dto';
import { BrandingV2Service } from './branding-v2.service';

/** Application-wide branding (name, logo, colours): read by everyone, written by super administrators. */
@ApiTags('v2 · Branding')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'branding', version: '2' })
export class BrandingV2Controller {
  constructor(private readonly branding: BrandingV2Service) {}

  @Get()
  @ApiOperation({ summary: 'The branding (defaults while none is stored)' })
  @ApiOkResponse({ type: BrandingV2View })
  get(@Ctx() ctx: RequestContext): Promise<BrandingV2View> {
    return this.branding.get(ctx);
  }

  @Put()
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Store the branding (super administrators)' })
  @ApiOkResponse({ type: BrandingV2View })
  save(
    @Ctx() ctx: RequestContext,
    @Body() body: BrandingV2Dto,
  ): Promise<BrandingV2View> {
    return this.branding.save(ctx, body);
  }

  @Delete()
  @Roles('SuperAdmin')
  @ApiOperation({
    summary: 'Back to the default branding (super administrators)',
  })
  @ApiOkResponse({ type: BrandingV2View })
  reset(@Ctx() ctx: RequestContext): Promise<BrandingV2View> {
    return this.branding.reset(ctx);
  }
}
