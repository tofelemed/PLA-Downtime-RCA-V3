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
import { SourceAuthorityDecisionsService } from './source-authority-decisions.service';
import {
  SOURCE_AUTHORITY_APPROVERS,
  SOURCE_AUTHORITY_WRITERS,
} from './source-authority-roles';
import {
  SourceAuthorityQueryDto,
  SourceAuthorityVersionDto,
  SourceAuthorityVersionListQueryDto,
} from './source-authority-v2.dto';
import { SourceAuthorityV2Service } from './source-authority-v2.service';
import {
  SourceAuthorityV2View,
  SourceAuthorityVersionV2View,
  toSourceAuthorityVersionView as toVersionView,
  toSourceAuthorityView as toView,
} from './source-authority-v2.view';

/**
 * The output source authority in force (SRC01, D05) and its SME E7 measurement hierarchy: ranked sources
 * at one boundary — calibrated primary totalizer, redundant measurement, reconciled record, approved
 * estimate — that the period actuals select from, with a substitution flag when a lower rank is used.
 * Versions are maker-checker (owner, 15 Oct 2026): drafted by the integration owner or production
 * accounting, in force only once production accounting approves them, never the author.
 */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'source-authority', version: '2' })
export class SourceAuthorityV2Controller {
  constructor(
    private readonly versions: SourceAuthorityV2Service,
    private readonly decisions: SourceAuthorityDecisionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'The source authority version in force for a unit (its override, else tenant-wide)',
  })
  async current(
    @Ctx() ctx: RequestContext,
    @Query() query: SourceAuthorityQueryDto,
  ): Promise<SourceAuthorityV2View> {
    return toView(await this.versions.current(ctx, query.unitId));
  }

  @Get('versions')
  @ApiOperation({
    summary:
      'Source authority versions (drafts, approved, rejected), newest first; keyset on createdAt, id',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: SourceAuthorityVersionListQueryDto,
  ): Promise<ListResponse<SourceAuthorityVersionV2View>> {
    return this.decisions.list(ctx, query);
  }

  @Post('versions')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Roles(...SOURCE_AUTHORITY_WRITERS)
  @ApiOperation({
    summary:
      'Draft a source authority version with a measurement hierarchy (or none) from the version in force; the top rank becomes the primary source. It applies only once approved.',
    description:
      'Requires `Idempotency-Key`. 403 TENANT_SCOPE_REQUIRED for a tenant-wide version without a tenant-wide grant; ' +
      '422 INVALID_REFERENCE (unit), INVALID_POLICY (ranks not unique, classes out of order, estimate not manual, ' +
      'same signal twice, lag on a non-signal source, top rank not at the hierarchy boundary).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async write(
    @Ctx() ctx: RequestContext,
    @Body() body: SourceAuthorityVersionDto,
  ): Promise<SourceAuthorityVersionV2View> {
    return toVersionView(await this.versions.draft(ctx, body));
  }

  @Get('versions/:id')
  @ApiOperation({
    summary:
      'One source authority version; foreign or out-of-scope ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SourceAuthorityVersionV2View> {
    return toVersionView(await this.decisions.get(ctx, id));
  }

  @Post('versions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...SOURCE_AUTHORITY_APPROVERS)
  @ApiOperation({
    summary:
      'Approve a draft version (production accounting, except SuperAdmin self-approval): in force from now, the previous version of the scope ends; calculated periods keep theirs until recalculated',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE unless a production_accountant; 403 SEPARATION_OF_DUTIES for the author; ' +
      '403 TENANT_SCOPE_REQUIRED (tenant-wide version); 409 INVALID_TRANSITION when not proposed; ' +
      '409 STALE_DRAFT when the version it was prepared from is no longer in force.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentApproveDto,
  ): Promise<SourceAuthorityVersionV2View> {
    return toVersionView(await this.decisions.approve(ctx, id, body.reason));
  }

  @Post('versions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...SOURCE_AUTHORITY_APPROVERS)
  @ApiOperation({
    summary:
      'Reject a draft version with a reason (production accounting, except SuperAdmin self-approval); the version in force stays',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE / SEPARATION_OF_DUTIES / TENANT_SCOPE_REQUIRED; 409 INVALID_TRANSITION when not proposed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentRejectDto,
  ): Promise<SourceAuthorityVersionV2View> {
    return toVersionView(await this.decisions.reject(ctx, id, body.reason));
  }
}
