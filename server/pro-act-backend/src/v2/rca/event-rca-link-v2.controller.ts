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
import { EventEvidencePackage } from '../../rca-case/evidence-package';
import {
  RcaLinkResultV2View,
  RcaLinksService,
} from '../../rca-case/rca-links.service';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { EventRcaLinkV2Dto } from './rca-links-v2.dto';
import { IDEMPOTENT_LINK } from './rca-links-v2.controller';

/** §15.2 `POST /events/{id}/rca-link` and the evidence preview of the link dialog. */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-events', version: '2' })
export class EventRcaLinkV2Controller {
  constructor(private readonly links: RcaLinksService) {}

  @Post(':id/rca-link')
  @Idempotent()
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Link the event to an existing case or create one with it',
    description:
      `${IDEMPOTENT_LINK} Body: exactly one of \`rcaId\` / \`create\`. The event's RCA state becomes linked and its ` +
      'open recommendations accepted; no coding or loss changes.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 201, description: 'Linked' })
  @ApiResponse({ status: 200, description: 'Already linked' })
  async link(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EventRcaLinkV2Dto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RcaLinkResultV2View> {
    const result = await this.links.linkEvent(ctx, id, body);
    if (!result.created) response.status(HttpStatus.OK);
    return result;
  }

  @Get(':id/rca-evidence')
  @ApiOperation({
    summary:
      'Evidence package the event would be linked with now (nothing stored)',
  })
  evidence(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EventEvidencePackage> {
    return this.links.preview(ctx, id);
  }
}
