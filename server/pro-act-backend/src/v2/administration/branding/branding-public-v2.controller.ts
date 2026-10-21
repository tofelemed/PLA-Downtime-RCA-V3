import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { BrandingPublicV2View } from './branding-v2.dto';
import { BrandingV2Service } from './branding-v2.service';

/**
 * The part of the branding the sign-in page shows before anyone signs in (settings audit, 21 Oct 2026): name,
 * subtitle, logo, initials, colour and browser icon. Public, cached for five minutes, nothing else.
 */
@ApiTags('v2 · Branding')
@Controller({ path: 'branding/public', version: '2' })
export class BrandingPublicV2Controller {
  constructor(private readonly branding: BrandingV2Service) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary:
      'Name, subtitle, logo, colour and browser icon for the sign-in page',
    description:
      'No sign-in needed: only what every visitor of the sign-in page sees.',
  })
  @ApiOkResponse({ type: BrandingPublicV2View })
  publicView(): Promise<BrandingPublicV2View> {
    return this.branding.publicView();
  }
}
