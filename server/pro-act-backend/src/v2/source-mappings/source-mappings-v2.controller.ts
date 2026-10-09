import { ReadOnlyAllowed } from '../../auth/decorators/read-only-allowed.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  SourceMappingListQueryDto,
  SourceMappingPreviewDto,
  SourceMappingV2WriteDto,
} from './source-mapping-v2.dto';
import {
  MappingPreviewView,
  SourceMappingV2View,
} from './source-mapping-v2.view';
import { SourceMappingsV2Service } from './source-mappings-v2.service';

/** Writers of integration configuration (engineering default, DECISIONS.md §D 2026-10-08). */
const MAPPING_WRITERS = ['integration_admin', 'manager_approver'] as const;

@ApiTags('v2 · Source Mappings')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'source-mappings', version: '2' })
export class SourceMappingsV2Controller {
  constructor(private readonly service: SourceMappingsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'List source → plant mapping rules of the caller tenant (ING03)',
    description:
      'Keyset pages on (createdAt, id); inactive rules only with includeInactive=true.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: SourceMappingListQueryDto,
  ): Promise<ListResponse<SourceMappingV2View>> {
    return this.service.list(ctx, query);
  }

  @ReadOnlyAllowed()
  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve sample identifiers without storing anything (spec §15.2)',
    description:
      'Each sample is resolved like an incoming record: exact id → exact path → pattern → AF binding. ' +
      'Returns the target (an asset target yields its unit) or `ambiguous` with the candidates, ' +
      '`invalid_target` (unit/asset outside the tenant) or `unmapped`, plus a summary.',
  })
  preview(
    @Ctx() ctx: RequestContext,
    @Body() body: SourceMappingPreviewDto,
  ): Promise<MappingPreviewView> {
    return this.service.preview(ctx, body);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one mapping rule (ETag = rowVersion); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SourceMappingV2View> {
    return this.service.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MAPPING_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create a mapping rule',
    description:
      'Requires `Idempotency-Key`. The target must be a unit or asset of the tenant (422 INVALID_REFERENCE); ' +
      'an active rule with the same kind and normalised value for the same connection is 409 MAPPING_EXISTS.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: SourceMappingV2WriteDto,
  ): Promise<SourceMappingV2View> {
    return this.service.create(ctx, body);
  }

  @Put(':id')
  @Roles(...MAPPING_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Replace a mapping rule (next version)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 without, 412 when stale). Rules mirrored from a v1 ' +
      'hierarchy mapping are edited through v1 (409 LEGACY_MAPPING).',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  replace(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRevision: number,
    @Body() body: SourceMappingV2WriteDto,
  ): Promise<SourceMappingV2View> {
    return this.service.replace(ctx, { id, expectedRevision }, body);
  }
}
