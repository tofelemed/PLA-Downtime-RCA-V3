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
  Res,
  UseGuards,
  UseInterceptors,
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
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { PlanApprovalService } from '../../plans/plan-approval.service';
import { PlanGenerationJobsService } from '../../plans/plan-generation-jobs.service';
import { PlanVersionsService } from '../../plans/plan-versions.service';
import { JobAccepted, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PLAN_APPROVERS, PLAN_WRITERS } from './plan-roles';
import {
  GeneratePeriodsDto,
  PlanApproveDto,
  PlanCreateDto,
  PlanListQueryDto,
  PlanPeriodListQueryDto,
  PlanVersionChangeDto,
  PlanVersionListQueryDto,
  PlanVersionParamsDto,
} from './plan-v2.dto';
import {
  PlanPeriodV2View,
  PlanPreviewV2View,
  PlanV2View,
  PlanVersionV2View,
  toPlanView,
  toVersionView,
} from './plan-v2.view';
import { PlansV2Service } from './plans-v2.service';

/** Versioned production plans and their periods (plan 2.3, PLAN02–PLAN05, §15.2 plan routes). */
@ApiTags('v2 · Production plans')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-plans', version: '2' })
export class ProductionPlansV2Controller {
  constructor(
    private readonly reads: PlansV2Service,
    private readonly plans: PlanVersionsService,
    private readonly approval: PlanApprovalService,
    private readonly jobs: PlanGenerationJobsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List plans with their current version (keyset on createdAt, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: PlanListQueryDto,
  ): Promise<ListResponse<PlanV2View>> {
    return this.reads.listPlans(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...PLAN_WRITERS)
  @ApiOperation({
    summary: 'Create a plan header and its draft version 1',
    description:
      'Requires `Idempotency-Key`. unitId, products, profile pins and scenarioId must be of the tenant and, for ' +
      'unit-limited callers, of their units (422 INVALID_REFERENCE). Default scenario: the accounting baseline.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: PlanCreateDto,
  ): Promise<PlanV2View> {
    const { plan, version } = await this.plans.createPlan(ctx, body);
    return toPlanView(plan, version, await this.plans.slicesOf(version.id));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'A plan with its current version and slices; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PlanV2View> {
    const { plan, version } = await this.plans.getPlan(ctx, id);
    return toPlanView(plan, version, await this.plans.slicesOf(version.id));
  }

  @Post(':id/versions')
  @Idempotent()
  @Roles(...PLAN_WRITERS)
  @ApiOperation({
    summary:
      'Open the next draft version from the current one plus changes (PLAN04)',
    description:
      'Requires `Idempotency-Key`. 409 DRAFT_EXISTS while an open version exists.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async newVersion(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PlanVersionChangeDto,
  ): Promise<PlanVersionV2View> {
    const version = await this.plans.newDraft(ctx, id, body);
    return toVersionView(version, await this.plans.slicesOf(version.id));
  }

  @Get(':id/versions')
  @ApiOperation({
    summary:
      'Version history of a plan, newest first (keyset on createdAt, id; no slices)',
    description:
      'States, supersession and approval of every version; foreign or out-of-scope plans are 404.',
  })
  versions(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PlanVersionListQueryDto,
  ): Promise<ListResponse<PlanVersionV2View>> {
    return this.reads.listVersions(ctx, id, query);
  }

  @Get(':id/versions/:version')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'One plan version with its slices (ETag = rowVersion)',
  })
  async getVersion(
    @Ctx() ctx: RequestContext,
    @Param() path: PlanVersionParamsDto,
  ): Promise<PlanVersionV2View> {
    const version = await this.plans.getVersion(ctx, path.id, path.version);
    return toVersionView(version, await this.plans.slicesOf(version.id));
  }

  @Patch(':id/versions/:version')
  @Roles(...PLAN_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Edit a draft version (its periods are discarded until the next generation)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412). 409 VERSION_NOT_DRAFT for other states.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async patchVersion(
    @Ctx() ctx: RequestContext,
    @Param() path: PlanVersionParamsDto,
    @IfMatch() expectedRevision: number,
    @Body() body: PlanVersionChangeDto,
  ): Promise<PlanVersionV2View> {
    const version = await this.plans.updateDraft(
      ctx,
      { planId: path.id, version: path.version, expectedRevision },
      body,
    );
    return toVersionView(version, await this.plans.slicesOf(version.id));
  }

  @Post(':id/generate-periods')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...PLAN_WRITERS)
  @ApiOperation({
    summary:
      'Preview (200) or generate (202 job) the periods of an open version (PLAN03)',
    description:
      'Requires `Idempotency-Key`. preview=true returns every leaf period with UTC bounds, local date, shift, ' +
      'slice, target, sustained capacity and source versions, plus totals per quantity unit and warnings, ' +
      'without storing anything. Otherwise 202 with a job; the worker replaces the draft periods. 422: ' +
      'NO_ELIGIBLE_TIME, CAMPAIGN_OVERLAP, INFEASIBLE_PRODUCT_MIX, CONCURRENT_PRODUCTS_DISABLED, MIXED_UOM, ' +
      'TARGET_REQUIRED, TARGET_SUM_MISMATCH; 409 VERSION_NOT_DRAFT.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 200, description: 'Preview (nothing stored)' })
  @ApiResponse({
    status: 202,
    description: 'Job accepted (`GET /plan-generation-jobs/{id}`)',
  })
  async generate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: GeneratePeriodsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlanPreviewV2View | JobAccepted> {
    if (body.preview) return this.reads.preview(ctx, id, body);
    const job = await this.jobs.request(ctx, id, body);
    response.status(HttpStatus.ACCEPTED);
    return {
      jobId: job.id,
      statusUrl: `/api/v2/plan-generation-jobs/${job.id}`,
    };
  }

  @Get(':id/versions/:version/periods')
  @ApiOperation({
    summary:
      'Stored periods of a version (keyset on utcStart, id; from/to overlap)',
  })
  periods(
    @Ctx() ctx: RequestContext,
    @Param() path: PlanVersionParamsDto,
    @Query() query: PlanPeriodListQueryDto,
  ): Promise<ListResponse<PlanPeriodV2View>> {
    return this.reads.listPeriods(
      ctx,
      { planId: path.id, version: path.version },
      query,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PLAN_APPROVERS)
  @ApiOperation({
    summary:
      'Approve the open version (PLAN04); the previous approved version is superseded',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. The author of the version (its creator) cannot approve it (403 ' +
      'SEPARATION_OF_DUTIES, all non-SuperAdmin roles). 409 PLAN_OVERLAP (details.conflicts) when an approved version of another plan ' +
      'in the same scenario plans the unit and product in an overlapping interval; 409 PERIODS_NOT_GENERATED; ' +
      '409 INVALID_TRANSITION for an approved or superseded version.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PlanApproveDto,
  ): Promise<PlanVersionV2View> {
    const version = await this.approval.approve(ctx, id, body);
    return toVersionView(version, await this.plans.slicesOf(version.id));
  }
}
