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
import { MASTER_DATA_WRITERS } from '../master-data/common/master-data-writer';
import {
  RcaCauseV2ChangeDto,
  RcaCauseV2CreateDto,
  RcaCauseV2ListQueryDto,
} from './rca-settings-v2.dto';
import { RcaCausesV2Service } from './rca-causes-v2.service';
import { RcaCauseV2View } from './rca-settings-v2.view';

/** RCA cause library of the acting plant (RCA settings in Master Data): a tree loaded level by level. */
@ApiTags('v2 · RCA Settings')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rca-causes', version: '2' })
export class RcaCausesV2Controller {
  constructor(private readonly causes: RcaCausesV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'List RCA causes of the plant (keyset; `activeChildren` per cause)',
    description:
      '`rootsOnly` = top-level causes, `parentId` = direct sub-causes; `q` searches code and name; ' +
      '`status` = active | retired | all (default all).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaCauseV2ListQueryDto,
  ): Promise<ListResponse<RcaCauseV2View>> {
    return this.causes.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Get one RCA cause (ETag = row version)' })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaCauseV2View> {
    return this.causes.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create an RCA cause (top level or under an active cause)',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. 409 MASTER_DATA_CODE_EXISTS for a code in use; ' +
      '422 INVALID_REFERENCE for a parent that is not an active cause of the plant.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: RcaCauseV2CreateDto,
  ): Promise<RcaCauseV2View> {
    return this.causes.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Change an RCA cause; `parentId` moves it with its subtree (null = top level)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412). 422 CODE_CYCLE for a parent inside its own subtree; ' +
      '409 MASTER_DATA_CODE_EXISTS, 409 MASTER_DATA_RETIRED.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: RcaCauseV2ChangeDto,
  ): Promise<RcaCauseV2View> {
    return this.causes.change(ctx, { id, expectedVersion }, body);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Retire an RCA cause',
    description:
      '409 RCA_CAUSE_HAS_CHILDREN (`details.activeChildren`) while it has active sub-causes.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaCauseV2View> {
    return this.causes.setActive(ctx, id, false);
  }

  @Post(':id/restore')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Restore a retired RCA cause (its parent must be active)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaCauseV2View> {
    return this.causes.setActive(ctx, id, true);
  }
}
