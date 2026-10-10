import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  RcaLinkResultV2View,
  RcaLinksService,
  RcaLinkV2View,
} from '../../rca-case/rca-links.service';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { RcaLinkV2CreateDto } from './rca-links-v2.dto';

export const IDEMPOTENT_LINK =
  'Requires `Idempotency-Key`. 201 new link, 200 when the target is already linked (idempotent).';

/** Links of a case (RCA02): events, loss lines, work orders and occurrences, each with its evidence package. */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rcas', version: '2' })
export class RcaLinksV2Controller {
  constructor(private readonly links: RcaLinksService) {}

  @Get(':id/links')
  @ApiOperation({
    summary:
      'Links of a case with their evidence packages (targets of your units)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaLinkV2View[]> {
    return this.links.list(ctx, id);
  }

  @Post(':id/links')
  @Idempotent()
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Link an event, loss line, work order or occurrence to the case',
    description: `${IDEMPOTENT_LINK} 422 INVALID_REFERENCE for a target outside your scope.`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 201, description: 'Linked' })
  @ApiResponse({ status: 200, description: 'Already linked' })
  async link(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RcaLinkV2CreateDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RcaLinkResultV2View> {
    const result = await this.links.link(ctx, id, body);
    if (!result.created) response.status(HttpStatus.OK);
    return result;
  }
}
