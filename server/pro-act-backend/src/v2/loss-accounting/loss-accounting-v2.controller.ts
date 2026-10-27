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
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  AdjustmentApproveDto,
  AdjustmentRejectDto,
} from '../periods/period-v2.dto';
import { LossAccountingDecisionsService } from './loss-accounting-decisions.service';
import {
  LOSS_ACCOUNTING_APPROVERS,
  LOSS_ACCOUNTING_WRITERS,
} from './loss-accounting-roles';
import {
  LossAccountingQueryDto,
  LossAccountingVersionDto,
  LossAccountingVersionListQueryDto,
} from './loss-accounting-v2.dto';
import { LossAccountingV2Service } from './loss-accounting-v2.service';
import {
  LossAccountingApprovalV2View,
  LossAccountingV2View,
  LossAccountingVersionV2View,
  toLossAccountingApprovalView,
  toLossAccountingVersionView as toVersionView,
  toLossAccountingView as toView,
} from './loss-accounting-v2.view';

/**
 * The production loss accounting policy in force (declared mode, D1-D12): the accounting grain (shift or
 * operational day), the loss basis (computed from the plan or declared by OT), the target source and the
 * tolerances. Versions are maker-checker: drafted by the plant administrator, the integration owner or
 * production accounting, in force only once another approver (production accounting or the manager)
 * approves them. Approving a day-grain version publishes the daily calendar from its effective date.
 */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'loss-accounting', version: '2' })
export class LossAccountingV2Controller {
  constructor(
    private readonly versions: LossAccountingV2Service,
    private readonly decisions: LossAccountingDecisionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'The loss accounting version in force for a unit (its override, else tenant-wide)',
  })
  async current(
    @Ctx() ctx: RequestContext,
    @Query() query: LossAccountingQueryDto,
  ): Promise<LossAccountingV2View> {
    return toView(await this.versions.current(ctx, query.unitId));
  }

  @Get('versions')
  @ApiOperation({
    summary:
      'Loss accounting versions (drafts, approved, rejected), newest first; keyset on createdAt, id',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: LossAccountingVersionListQueryDto,
  ): Promise<ListResponse<LossAccountingVersionV2View>> {
    return this.decisions.list(ctx, query);
  }

  @Post('versions')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Roles(...LOSS_ACCOUNTING_WRITERS)
  @ApiOperation({
    summary:
      'Draft a loss accounting version from the version in force; fields left out are kept. It applies only once approved (from approval time, or from a past effectiveFrom while commissioning).',
    description:
      'Requires `Idempotency-Key`. 403 TENANT_SCOPE_REQUIRED for a tenant-wide version without a tenant-wide grant; ' +
      '422 INVALID_REFERENCE (unit, accountingUnitId), INVALID_POLICY (the policy parser refuses the merged body); ' +
      '422 INVALID_EFFECTIVE_FROM / BACKDATE_REASON_REQUIRED, 409 BACKDATE_REWRITES_HISTORY / BACKDATE_OVERLAPS_CALCULATION (commissioning backdate).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async write(
    @Ctx() ctx: RequestContext,
    @Body() body: LossAccountingVersionDto,
  ): Promise<LossAccountingVersionV2View> {
    return toVersionView(await this.versions.draft(ctx, body));
  }

  @Get('versions/:id')
  @ApiOperation({
    summary: 'One loss accounting version; foreign or out-of-scope ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<LossAccountingVersionV2View> {
    return toVersionView(await this.decisions.get(ctx, id));
  }

  @Post('versions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...LOSS_ACCOUNTING_APPROVERS)
  @ApiOperation({
    summary:
      'Approve a draft version (another approver than the author): in force from now, the previous version of the scope ends; calculated periods keep theirs until recalculated. A day-grain version publishes the daily calendar and replaces the open periods it covers; the response carries `calendar` (versionId, effectiveFrom, retired, kept; null for shift grain).',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE unless a production_accountant or manager_approver; 403 SEPARATION_OF_DUTIES for the author; ' +
      '403 TENANT_SCOPE_REQUIRED (tenant-wide version); 409 INVALID_TRANSITION when not proposed; ' +
      '409 STALE_DRAFT when the version it was prepared from is no longer in force. A draft with a commissioning ' +
      'backdate takes effect at its requestedEffectiveFrom; the checks are repeated now: 409 BACKDATE_REWRITES_HISTORY, ' +
      '409 BACKDATE_OVERLAPS_CALCULATION (details.periods); 422 EFFECTIVE_DATE_TOO_EARLY (day grain: a period with an approved revision starts on or after the effective date). ' +
      'Day grain: the daily calendar starts at the first dayStart on or after the effective date that is not before the end of the last period with calculation history ' +
      '(calendar.effectiveFrom, plant local); old-calendar shifts from there are removed and the shift crossing it ends there; 409 SWITCH_CROSSES_CALCULATION when a period after that start gained calculation history meanwhile.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentApproveDto,
  ): Promise<LossAccountingApprovalV2View> {
    const done = await this.decisions.approve(ctx, id, body.reason);
    return toLossAccountingApprovalView(done.row, done.daily);
  }

  @Post('versions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...LOSS_ACCOUNTING_APPROVERS)
  @ApiOperation({
    summary:
      'Reject a draft version with a reason (another approver than the author); the version in force stays',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE / SEPARATION_OF_DUTIES / TENANT_SCOPE_REQUIRED; 409 INVALID_TRANSITION when not proposed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentRejectDto,
  ): Promise<LossAccountingVersionV2View> {
    return toVersionView(await this.decisions.reject(ctx, id, body.reason));
  }
}
