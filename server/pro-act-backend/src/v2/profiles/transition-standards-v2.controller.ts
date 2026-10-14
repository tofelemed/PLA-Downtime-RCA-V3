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
import { TransitionStandardsService } from '../../profiles/transition-standards.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS, PROFILE_WRITERS } from './profile-roles';
import { APPROVE_DESCRIPTION, ApproveDto } from './profile-v2.dto';
import {
  TransitionStandardCreateDto,
  TransitionStandardListQueryDto,
} from './transition-standard-v2.dto';
import {
  toTransitionStandardView,
  TransitionStandardV2View,
} from './transition-standard-v2.view';
import { TransitionStandardsV2Service } from './transition-standards-v2.service';

/**
 * The grade-transition matrix (LA-08, SME Q9 / E1): approved reference durations per unit and
 * directional product change, maker-checker like rates; the accounting engine splits transition loss
 * into allowance and overrun against the version in force at the transition's start.
 */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'transition-standards', version: '2' })
export class TransitionStandardsV2Controller {
  constructor(
    private readonly lists: TransitionStandardsV2Service,
    private readonly standards: TransitionStandardsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List transition standard versions (keyset on effectiveFrom, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: TransitionStandardListQueryDto,
  ): Promise<ListResponse<TransitionStandardV2View>> {
    return this.lists.list(ctx, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one transition standard version; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TransitionStandardV2View> {
    return toTransitionStandardView(await this.standards.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @ApiOperation({
    summary: 'Create a draft transition standard version',
    description:
      'Requires `Idempotency-Key`. Unit and products of the tenant (422 INVALID_REFERENCE); from ≠ to ' +
      '(422 SAME_PRODUCT); referenceSeconds > 0 (422 INVALID_REFERENCE_SECONDS); a reference off-grade ' +
      'quantity needs offgradeUom (422 UOM_REQUIRED).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: TransitionStandardCreateDto,
  ): Promise<TransitionStandardV2View> {
    return toTransitionStandardView(await this.standards.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft transition standard version',
    description: APPROVE_DESCRIPTION,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<TransitionStandardV2View> {
    return toTransitionStandardView(
      await this.standards.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved transition standard version',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TransitionStandardV2View> {
    return toTransitionStandardView(await this.standards.retire(ctx, id));
  }
}
