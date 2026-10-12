import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { PlanReviewService } from '../../plans/plan-review.service';
import { PlanVersionsService } from '../../plans/plan-versions.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PLAN_APPROVERS, PLAN_WRITERS } from './plan-roles';
import { PlanReturnDto, PlanSubmitDto } from './plan-v2.dto';
import { PlanVersionV2View, toVersionView } from './plan-v2.view';

/**
 * Review of a plan's open version before approval: the author submits it, a manager approver approves
 * it (`ProductionPlansV2Controller.approve`) or returns it to the author with a reason.
 */
@ApiTags('v2 · Production plans')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-plans', version: '2' })
export class ProductionPlanReviewV2Controller {
  constructor(
    private readonly review: PlanReviewService,
    private readonly plans: PlanVersionsService,
  ) {}

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PLAN_WRITERS)
  @ApiOperation({
    summary: 'Submit the draft version for approval (draft → submitted)',
    description:
      'Requires `Idempotency-Key`. Records who submitted it on the plan; a submitted version stays editable ' +
      'and is approved or returned by a manager approver. 409 INVALID_TRANSITION for an approved or ' +
      'superseded version; submitting a submitted version returns it unchanged.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async submit(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PlanSubmitDto,
  ): Promise<PlanVersionV2View> {
    const version = await this.review.submit(ctx, id, body);
    return toVersionView(version, await this.plans.slicesOf(version.id));
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PLAN_APPROVERS)
  @ApiOperation({
    summary: 'Return the submitted version to its author with a reason (submitted → draft)',
    description:
      'Requires `Idempotency-Key`. The reason is kept on the plan for the author. 403 SEPARATION_OF_DUTIES ' +
      'for the author of the version (any role); 409 INVALID_TRANSITION unless the version is submitted.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async returnToAuthor(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PlanReturnDto,
  ): Promise<PlanVersionV2View> {
    const version = await this.review.returnToAuthor(ctx, id, body);
    return toVersionView(version, await this.plans.slicesOf(version.id));
  }
}
