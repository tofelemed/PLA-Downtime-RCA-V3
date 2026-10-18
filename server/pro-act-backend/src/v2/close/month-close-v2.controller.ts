import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { MonthCloseService } from '../../close/month-close.service';
import { MonthCloseAction } from '../../domain/close/month-close-machine';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  FINANCE_SIGNERS,
  MATERIALITY_REVIEWERS,
  MONTH_REOPENERS,
  QUANTITY_CLOSERS,
} from './close-roles';
import {
  MonthCloseReopenDto,
  MonthCloseStepDto,
  MonthParamDto,
} from './month-close-v2.dto';
import { MonthCloseV2View, toMonthCloseView } from './month-close-v2.view';

const STEP =
  'Requires `Idempotency-Key` and a tenant-wide grant (403 TENANT_SCOPE_REQUIRED). 409 INVALID_TRANSITION ' +
  'from another state; ';

/**
 * Month close of the plant (SME R1 / R4, EXPERT_REVIEW phase R-B): working-day deadlines from the plant
 * calendar and holidays, prerequisites, two independent sign-offs, materiality review and lock. Every
 * step answers the month view.
 */
@ApiTags('v2 · Month close')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'month-closes', version: '2' })
export class MonthCloseV2Controller {
  constructor(private readonly closes: MonthCloseService) {}

  @Get('current')
  @ApiOperation({
    summary: 'The month close of the month containing today (plant time)',
  })
  async current(@Ctx() ctx: RequestContext): Promise<MonthCloseV2View> {
    return toMonthCloseView(await this.closes.snapshot(ctx, 'current'));
  }

  @Get(':month')
  @ApiOperation({
    summary:
      'Month close: state, working-day deadlines and overdue flags, sign-offs, prerequisites (periods not ' +
      'approved, open change proposals), materiality findings and history',
    description:
      'Read-only; a month never acted on is open. 422 INVALID_MONTH for a malformed key.',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param() params: MonthParamDto,
  ): Promise<MonthCloseV2View> {
    return toMonthCloseView(
      await this.closes.snapshot(ctx, { key: params.month }),
    );
  }

  @Post(':month/close-quantities')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...QUANTITY_CLOSERS)
  @ApiOperation({
    summary: 'Plant management closes the month’s quantities',
    description:
      STEP +
      '422 CLOSE_PREREQUISITES (details list the periods not approved and the open change proposals). ' +
      'Fixes whether the materiality review is required.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  closeQuantities(
    @Ctx() ctx: RequestContext,
    @Param() params: MonthParamDto,
    @Body() body: MonthCloseStepDto,
  ): Promise<MonthCloseV2View> {
    return this.step(ctx, params.month, 'close_quantities', body.comment);
  }

  @Post(':month/materiality-review')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...MATERIALITY_REVIEWERS)
  @ApiOperation({
    summary: 'Extra review of a month above a materiality threshold',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      STEP +
      '403 MATERIALITY_REVIEWER without a reviewer role of the policy, SEPARATION_OF_DUTIES for the quantity ' +
      'signer; 409 MATERIALITY_REVIEW_NOT_REQUIRED.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reviewMateriality(
    @Ctx() ctx: RequestContext,
    @Param() params: MonthParamDto,
    @Body() body: MonthCloseStepDto,
  ): Promise<MonthCloseV2View> {
    return this.step(ctx, params.month, 'review_materiality', body.comment);
  }

  @Post(':month/finance-sign-off')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...FINANCE_SIGNERS)
  @ApiOperation({
    summary: 'Finance signs the month off',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      STEP +
      '403 SEPARATION_OF_DUTIES for the quantity signer or the materiality reviewer; 409 ' +
      'MATERIALITY_REVIEW_REQUIRED; 422 CLOSE_PREREQUISITES.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  signOffFinance(
    @Ctx() ctx: RequestContext,
    @Param() params: MonthParamDto,
    @Body() body: MonthCloseStepDto,
  ): Promise<MonthCloseV2View> {
    return this.step(ctx, params.month, 'sign_off_finance', body.comment);
  }

  @Post(':month/lock')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...FINANCE_SIGNERS)
  @ApiOperation({
    summary:
      'Lock the signed-off month: its approved periods change only through change proposals (after close)',
    description: STEP + '422 CLOSE_PREREQUISITES.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  lock(
    @Ctx() ctx: RequestContext,
    @Param() params: MonthParamDto,
    @Body() body: MonthCloseStepDto,
  ): Promise<MonthCloseV2View> {
    return this.step(ctx, params.month, 'lock', body.comment);
  }

  @Post(':month/reopen')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...MONTH_REOPENERS)
  @ApiOperation({
    summary:
      'Reopen a month whose quantities are closed or finance signed off (clears every sign-off)',
    description: STEP + 'a locked month is never reopened.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reopen(
    @Ctx() ctx: RequestContext,
    @Param() params: MonthParamDto,
    @Body() body: MonthCloseReopenDto,
  ): Promise<MonthCloseV2View> {
    return this.step(ctx, params.month, 'reopen', body.reason);
  }

  private async step(
    ctx: RequestContext,
    month: string,
    action: MonthCloseAction,
    comment: string | undefined,
  ): Promise<MonthCloseV2View> {
    return toMonthCloseView(
      await this.closes.act(ctx, month, { action, comment: comment ?? null }),
    );
  }
}
