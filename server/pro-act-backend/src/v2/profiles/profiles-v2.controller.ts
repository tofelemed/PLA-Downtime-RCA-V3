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
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ProfileResolutionService } from '../../profiles/profile-resolution.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { RatesService } from '../../profiles/rates.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS, PROFILE_WRITERS } from './profile-roles';
import {
  ApproveDto,
  ProfileCreateDto,
  ProfileListQueryDto,
  ProfilePatchDto,
  ProfileResolveQueryDto,
} from './profile-v2.dto';
import {
  ProfileResolutionV2View,
  ProfileV2View,
  RateV2View,
  toProfileView,
  toRateView,
  toResolutionView,
} from './profile-v2.view';
import { ProfilesV2Service } from './profiles-v2.service';
import { RateCreateDto, RateListQueryDto } from './rate-v2.dto';

/** Production profiles and their rates (plan 2.2, PLAN01, §15.2 `/profiles`). */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'profiles', version: '2' })
export class ProfilesV2Controller {
  constructor(
    private readonly lists: ProfilesV2Service,
    private readonly profiles: ProfilesService,
    private readonly rates: RatesService,
    private readonly resolution: ProfileResolutionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List profile versions (keyset on createdAt, id)' })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ProfileListQueryDto,
  ): Promise<ListResponse<ProfileV2View>> {
    return this.lists.listProfiles(ctx, query);
  }

  @Get('resolve')
  @ApiOperation({
    summary:
      'The approved profile and the approved rate of each kind in force at `at`',
    description:
      'unitId / productId must be of the tenant (422 INVALID_REFERENCE). No approved profile → ' +
      '`profile: null, reason: "no_profile"`.',
  })
  async resolve(
    @Ctx() ctx: RequestContext,
    @Query() query: ProfileResolveQueryDto,
  ): Promise<ProfileResolutionV2View> {
    const resolution = await this.resolution.resolveForCaller(ctx, {
      unitId: query.unitId,
      productId: query.productId,
      operatingMode: query.operatingMode,
      at: new Date(query.at),
    });
    return toResolutionView(resolution);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one profile version (ETag = rowVersion); foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProfileV2View> {
    return toProfileView(await this.profiles.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Create a draft profile version (next version of unit, product and operating mode)',
    description:
      'Requires `Idempotency-Key`. unitId / productId must be of the tenant (422 INVALID_REFERENCE); ' +
      'effectiveTo after effectiveFrom (422 INVALID_EFFECTIVE_DATES).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: ProfileCreateDto,
  ): Promise<ProfileV2View> {
    return toProfileView(await this.profiles.create(ctx, body));
  }

  @Patch(':id')
  @Roles(...PROFILE_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Edit a draft profile version',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 without, 412 when stale). Approved and retired versions are ' +
      'immutable: 409 VERSION_NOT_DRAFT.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRevision: number,
    @Body() body: ProfilePatchDto,
  ): Promise<ProfileV2View> {
    return toProfileView(
      await this.profiles.update(ctx, { id, expectedRevision }, body),
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft profile version',
    description:
      'Requires `Idempotency-Key`. The draft author cannot approve it (403 SEPARATION_OF_DUTIES, any role). ' +
      '409 VERSION_OVERLAP (details.conflicts) when it overlaps an approved version ' +
      'of the same unit, product and mode, unless `supersede` closes the predecessor at its effectiveFrom; ' +
      '422 PROFILE_INCOMPLETE without quantityUom and rateTimebase.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<ProfileV2View> {
    return toProfileView(
      await this.profiles.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved profile version (never deleted)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProfileV2View> {
    return toProfileView(await this.profiles.retire(ctx, id));
  }

  @Get(':id/rates')
  @ApiOperation({
    summary: 'Rate versions of a profile (keyset on effectiveFrom, id)',
  })
  listRates(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RateListQueryDto,
  ): Promise<ListResponse<RateV2View>> {
    return this.lists.listRates(ctx, id, query);
  }

  @Post(':id/rates')
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @ApiOperation({
    summary:
      'Create a draft rate version of the profile (next version of its kind)',
    description:
      'Requires `Idempotency-Key`. 422 INVALID_RATE (negative, or zero for nameplate/demonstrated/sustained/' +
      'planning), RATE_OUTSIDE_PROFILE (effectiveFrom outside the profile version), INVALID_EFFECTIVE_DATES.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createRate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RateCreateDto,
  ): Promise<RateV2View> {
    return toRateView(await this.rates.create(ctx, id, body));
  }
}
