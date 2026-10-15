import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  StopDecisionDto,
  StopReconciliationListQueryDto,
} from './stop-events-v2.dto';
import { StopReconciliationV2View } from './stop-events-v2.view';
import { StopReconciliationsV2Service } from './stop-reconciliations-v2.service';

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };

/** DT-04 / SME D5 duplicate stops: merges (automatic or accepted), suggestions, undo (plan 1.10 SRC02). */
@ApiTags('v2 · Stop events')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'stop-reconciliations', version: '2' })
export class StopReconciliationsV2Controller {
  constructor(private readonly service: StopReconciliationsV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'Duplicate-stop pairs of the caller’s units (newest first; keyset)',
    description:
      'A pair = one stop recorded twice (manual, PI / MQTT frame, state engine). `merged`: the evidence is ' +
      'superseded by the kept stop (best timing authority: state engine → source → import → manual) and filled ' +
      'its empty cause fields (`copied`); `suggested`: a person decides (same source, cause conflict, ambiguous); ' +
      '`rejected` / `undone` are never proposed again; `expired` no longer matches.',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: StopReconciliationListQueryDto,
  ): Promise<ListResponse<StopReconciliationV2View>> {
    const page = await this.service.list(ctx, query);
    return listResponse(page.items, page.nextCursor, {
      tenantId: requireTenantId(ctx),
    });
  }

  @Post(':id/accept')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Merge a suggested duplicate',
    description:
      'Requires `Idempotency-Key`. The kept stop keeps its timing and its own causes; empty cause fields are ' +
      'filled from the evidence, which becomes superseded (revisions with the caller as actor). 409 ' +
      'INVALID_STATE when the pair is not suggested or a stop is no longer live; 404 outside the caller’s units.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  accept(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StopDecisionDto,
  ): Promise<StopReconciliationV2View> {
    return this.service.accept(ctx, id, body.reason);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a suggested duplicate (two different stops)',
    description:
      'Requires `Idempotency-Key`. The pair is never proposed again. 409 INVALID_STATE unless suggested / expired.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StopDecisionDto,
  ): Promise<StopReconciliationV2View> {
    return this.service.reject(ctx, id, body.reason);
  }

  @Post(':id/undo')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undo a duplicate merge',
    description:
      'Requires `Idempotency-Key`. The evidence is live again in its own occurrence, copied cause values still ' +
      'unchanged are cleared, the pair is never merged again automatically. 409 INVALID_STATE unless merged, or ' +
      'when the kept stop was split, merged or retracted since.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  undo(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StopDecisionDto,
  ): Promise<StopReconciliationV2View> {
    return this.service.undo(ctx, id, body.reason);
  }
}
