import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Roles } from '../../auth/decorators/roles.decorator';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { RcaActionV2View } from '../../rca-case/rca-action.view';
import { RcaActionsService } from '../../rca-case/rca-actions.service';
import { RcaBaselineCorrectionsService } from '../../rca-case/rca-baseline-corrections.service';
import {
  RcaRecommendationsService,
  RcaRecommendationV2View,
} from '../../rca-case/rca-recommendations.service';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  RcaActionV2CreateDto,
  RcaActionV2UpdateDto,
  RcaBaselineCorrectionDto,
  RcaBaselineDecisionDto,
} from './rca-actions-v2.dto';
import {
  RcaRecommendationDismissV2Dto,
  RcaRecommendationV2ListQueryDto,
} from './rca-links-v2.dto';

/** RCA03 actions of a case: owner, due, status, completion evidence, verification against a baseline. */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class RcaActionsV2Controller {
  constructor(
    private readonly actions: RcaActionsService,
    private readonly recommendations: RcaRecommendationsService,
    private readonly corrections: RcaBaselineCorrectionsService,
  ) {}

  @Get('rcas/:id/actions')
  @ApiOperation({ summary: 'Actions of a case with their verification status' })
  list(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaActionV2View[]> {
    return this.actions.list(ctx, id);
  }

  @Post('rcas/:id/actions')
  @Idempotent()
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Add an action',
    description:
      'Requires `Idempotency-Key`. A baseline without value is counted from history over its windowDays before ' +
      'the verification window (422 BASELINE_NEEDS_WINDOW without one); a claim needs its currency.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RcaActionV2CreateDto,
  ): Promise<RcaActionV2View> {
    return this.actions.create(ctx, id, body);
  }

  @Patch('rca-actions/:id')
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Change an action',
    description: 'Requires `If-Match` (428/412).',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RcaActionV2UpdateDto,
  ): Promise<RcaActionV2View> {
    return this.actions.update(ctx, { id, expectedRowVersion }, body);
  }

  @Post('rca-actions/:id/verify')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary:
      'Verify now (the worker also does it hourly once the window has ended)',
    description:
      'Requires `Idempotency-Key` and `If-Match`. 409 VERIFICATION_WINDOW_OPEN / VERIFICATION_NOT_PLANNED.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'If-Match', required: true })
  verify(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<RcaActionV2View> {
    return this.actions.verify(ctx, id, expectedRowVersion);
  }

  @Post('rca-actions/:id/baseline-correction')
  @HttpCode(HttpStatus.OK)
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary:
      'Propose a correction of the computed baseline, with its reason (SME CA3)',
    description:
      'Requires `If-Match`. The counted baseline is kept; the correction counts once someone else approves it. ' +
      '409 BASELINE_NOT_COMPUTED for a baseline typed before CA3 or without a verification plan.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  proposeCorrection(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RcaBaselineCorrectionDto,
  ): Promise<RcaActionV2View> {
    return this.corrections.propose(ctx, { id, expectedRowVersion }, body);
  }

  @Post('rca-actions/:id/baseline-correction/decision')
  @HttpCode(HttpStatus.OK)
  @Roles('manager_approver')
  @ApiOperation({
    summary: 'Approve or reject a proposed baseline correction (SME CA3)',
    description:
      'Requires `If-Match`. Manager approver other than the proposer (403 SEPARATION_OF_DUTIES); 409 ' +
      'NO_PENDING_CORRECTION. Approving clears the verification result so the action is evaluated again.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  decideCorrection(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RcaBaselineDecisionDto,
  ): Promise<RcaActionV2View> {
    return this.corrections.decide(ctx, { id, expectedRowVersion }, body);
  }

  @Get('rca-recommendations')
  @ApiOperation({
    summary:
      'RCA recommendations recorded by the trigger service (badges), newest first',
    description:
      'Default state open; filter by events (repeat eventIds) or unit.',
  })
  listRecommendations(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaRecommendationV2ListQueryDto,
  ): Promise<ListResponse<RcaRecommendationV2View>> {
    return this.recommendations.list(ctx, query);
  }

  @Post('rca-recommendations/:id/dismiss')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Dismiss an open recommendation with a reason',
    description: 'Requires `Idempotency-Key`.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  dismiss(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RcaRecommendationDismissV2Dto,
  ): Promise<RcaRecommendationV2View> {
    return this.recommendations.dismiss(ctx, id, body.reason);
  }
}
