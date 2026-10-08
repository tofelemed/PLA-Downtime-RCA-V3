import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { EventRevisionService } from '../../production-event/revisions/event-revision.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  EventReviewItemView,
  toEventReviewItemView,
} from '../production-events/production-event-history.view';
import { ResolveReviewItemDto } from './resolve-review-item.dto';

@ApiTags('v2 · Event Review Items')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'event-review-items', version: '2' })
export class EventReviewItemsV2Controller {
  constructor(private readonly revisions: EventRevisionService) {}

  @Post(':id/resolve')
  @Idempotent()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve a source/override review item (spec §5.3)',
    description:
      'Requires `Idempotency-Key`. `accept_source` writes the latest source value and drops the override ' +
      '(coding and effective revision recorded); `keep_override` keeps the user value. 404 for a foreign ' +
      'or unknown item, 409 REVIEW_ITEM_RESOLVED when it is no longer open.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async resolve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ResolveReviewItemDto,
  ): Promise<EventReviewItemView> {
    const item = await this.revisions.resolveReviewItem(ctx, id, body.decision);
    return toEventReviewItemView(item);
  }
}
