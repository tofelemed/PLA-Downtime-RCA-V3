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
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ToleranceAdoptionService } from '../../uncertainty/tolerance-adoption.service';
import { UncertaintyBudgetsService } from '../../uncertainty/uncertainty-budgets.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  AdjustmentApproveDto,
  AdjustmentRejectDto,
} from '../periods/period-v2.dto';
import {
  ToleranceAdoptionDto,
  UncertaintyBudgetCreateDto,
  UncertaintyBudgetListQueryDto,
  UncertaintyBudgetMathsDto,
} from './uncertainty-budget-v2.dto';
import {
  AdoptedToleranceV2View,
  toAdoptedToleranceView,
  toUncertaintyBudgetView,
  UncertaintyBudgetV2View,
  UncertaintyPreviewV2View,
} from './uncertainty-budget-v2.view';
import { UncertaintyBudgetsV2Service } from './uncertainty-budgets-v2.service';
import {
  BUDGET_APPROVERS,
  BUDGET_WRITERS,
  TOLERANCE_ADOPTERS,
} from './uncertainty-roles';

/**
 * Uncertainty budgets per measurement boundary (SME E4): meter, scale, inventory, conversion and timing
 * standard uncertainties with optional correlations, combined (root sum of squares with covariance) and
 * expanded (coverage factor k) by the server; maker-checker (approved by the metrology owner), effective-dated, with calibration evidence
 * and a review date. An approved budget can justify an absolute reconciliation tolerance by an explicit
 * adoption — never automatically.
 */
@ApiTags('v2 · Reconciliation and approval')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'uncertainty-budgets', version: '2' })
export class UncertaintyBudgetsV2Controller {
  constructor(
    private readonly lists: UncertaintyBudgetsV2Service,
    private readonly budgets: UncertaintyBudgetsService,
    private readonly adoption: ToleranceAdoptionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List uncertainty budgets (effective interval overlapping [from, to); keyset on effectiveFrom, id, newest first)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: UncertaintyBudgetListQueryDto,
  ): Promise<ListResponse<UncertaintyBudgetV2View>> {
    return this.lists.list(ctx, query);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Roles(...BUDGET_WRITERS)
  @ApiOperation({
    summary:
      'Compute a draft budget (combined standard and expanded uncertainty, contributions); nothing is stored',
    description:
      '422 INVALID_BUDGET (no component, k ≤ 0, |r| > 1, a pair correlated twice, negative variance).',
  })
  preview(@Body() body: UncertaintyBudgetMathsDto): UncertaintyPreviewV2View {
    return this.budgets.preview(body).result;
  }

  @Post()
  @Idempotent()
  @Roles(...BUDGET_WRITERS)
  @ApiOperation({
    summary: 'Propose an uncertainty budget for a unit’s measurement boundary',
    description:
      'Requires `Idempotency-Key`. 422 INVALID_REFERENCE (unit outside the caller’s scope), INVALID_BUDGET, ' +
      'INVALID_RANGE (review not after the effective date).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: UncertaintyBudgetCreateDto,
  ): Promise<UncertaintyBudgetV2View> {
    return toUncertaintyBudgetView(await this.budgets.propose(ctx, body));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One uncertainty budget; foreign or out-of-scope ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UncertaintyBudgetV2View> {
    return toUncertaintyBudgetView(await this.budgets.get(ctx, id));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...BUDGET_APPROVERS)
  @ApiOperation({
    summary:
      'Approve a proposed budget (metrology / instrumentation owner, never the author); it is in force from its effective date and ends the previous one of the boundary',
    description:
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE unless a metrology_approver; 403 SEPARATION_OF_DUTIES for the author; ' +
      '409 INVALID_TRANSITION when not proposed; 422 INVALID_EFFECTIVE_FROM when not after the budget in force.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentApproveDto,
  ): Promise<UncertaintyBudgetV2View> {
    return toUncertaintyBudgetView(
      await this.budgets.approve(ctx, id, body.reason),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...BUDGET_APPROVERS)
  @ApiOperation({
    summary:
      'Reject a proposed budget with a reason (metrology / instrumentation owner, never the author)',
    description:
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE / SEPARATION_OF_DUTIES; 409 INVALID_TRANSITION when not proposed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentRejectDto,
  ): Promise<UncertaintyBudgetV2View> {
    return toUncertaintyBudgetView(
      await this.budgets.reject(ctx, id, body.reason),
    );
  }

  @Post(':id/adopt-as-tolerance')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...TOLERANCE_ADOPTERS)
  @ApiOperation({
    summary:
      'Make the budget’s expanded uncertainty the unit’s absolute reconciliation tolerance (new tolerance version, effective now)',
    description:
      'Requires `Idempotency-Key`. Explicit decision, never automatic. 403 SEPARATION_OF_DUTIES for the budget’s author; ' +
      '422 BUDGET_NOT_IN_FORCE (not approved or not effective now), BUDGET_REVIEW_OVERDUE, INVALID_POLICY.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async adopt(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ToleranceAdoptionDto,
  ): Promise<AdoptedToleranceV2View> {
    return toAdoptedToleranceView(
      await this.adoption.adopt(ctx, id, body.notes),
    );
  }
}
