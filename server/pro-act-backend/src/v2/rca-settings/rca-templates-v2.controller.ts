import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import { MASTER_DATA_WRITERS } from '../master-data/common/master-data-writer';
import {
  RcaTemplateV2ChangeDto,
  RcaTemplateV2CreateDto,
} from './rca-settings-v2.dto';
import { RcaTemplateV2View } from './rca-settings-v2.view';
import { RcaTemplatesV2Service } from './rca-templates-v2.service';

/** RCA templates of the acting plant (RCA settings in Master Data): logic tree and checklists. */
@ApiTags('v2 · RCA Settings')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rca-templates', version: '2' })
export class RcaTemplatesV2Controller {
  constructor(private readonly templates: RcaTemplatesV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'List the RCA templates of the plant (keyset; no logic tree, `nodeCount` instead)',
    description:
      '`q` searches name and category; `status` = active | retired | all (default all); `sort` code sorts by name.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: MasterDataListQueryDto,
  ): Promise<ListResponse<RcaTemplateV2View>> {
    return this.templates.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one RCA template with its logic tree (ETag = row version)',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaTemplateV2View> {
    return this.templates.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create an RCA template',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. 422 INVALID_REFERENCE for a logic tree beyond 500 ' +
      'nodes / 12 levels, repeated node ids, or checklists that are not active checklists of the plant.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: RcaTemplateV2CreateDto,
  ): Promise<RcaTemplateV2View> {
    return this.templates.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Change an RCA template (a given `logicTree` replaces the whole tree)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412). 409 MASTER_DATA_RETIRED for a retired template.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: RcaTemplateV2ChangeDto,
  ): Promise<RcaTemplateV2View> {
    return this.templates.change(ctx, { id, expectedVersion }, body);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Retire an RCA template (cases that used it keep it)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaTemplateV2View> {
    return this.templates.setActive(ctx, id, false);
  }

  @Post(':id/restore')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({ summary: 'Restore a retired RCA template' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaTemplateV2View> {
    return this.templates.setActive(ctx, id, true);
  }
}
