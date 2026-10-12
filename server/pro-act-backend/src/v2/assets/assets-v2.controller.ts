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
  AssetV2ChangeDto,
  AssetV2CreateDto,
  AssetV2ListQueryDto,
} from './asset-v2.dto';
import { AssetV2View } from './asset-v2.view';
import { AssetsV2CommandsService } from './assets-v2-commands.service';
import { AssetsV2Service } from './assets-v2.service';

/** Assets of the acting plant (master-data screens, asset pickers). */
@ApiTags('v2 · Assets')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'assets', version: '2' })
export class AssetsV2Controller {
  constructor(
    private readonly assets: AssetsV2Service,
    private readonly commands: AssetsV2CommandsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List the assets of the caller scope (keyset; sort createdAt, code or name)',
    description:
      'Tenant from the identity; unit-scoped callers see the assets of their units. Filters: `unitIds`, ' +
      '`q` (code and name), `status` = active | retired | all (default all).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: AssetV2ListQueryDto,
  ): Promise<ListResponse<AssetV2View>> {
    return this.assets.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one asset (ETag = row version); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AssetV2View> {
    return this.assets.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create an asset under an active unit of the acting plant',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. 409 MASTER_DATA_CODE_EXISTS for a code in use in ' +
      'the plant; 422 INVALID_REFERENCE for a unit outside the plant or retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: AssetV2CreateDto,
  ): Promise<AssetV2View> {
    return this.commands.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Change an asset (may move it to another active unit)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412 STALE_REVISION). 409 MASTER_DATA_CODE_EXISTS, 409 ' +
      'MASTER_DATA_RETIRED, 422 INVALID_REFERENCE as on create.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: AssetV2ChangeDto,
  ): Promise<AssetV2View> {
    return this.commands.change(ctx, { id, expectedVersion }, body);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Retire an asset (history and references stay)',
    description:
      'Requires `Idempotency-Key`. 409 MASTER_DATA_RETIRED when already retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AssetV2View> {
    return this.commands.retire(ctx, id);
  }

  @Post(':id/restore')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Restore a retired asset (its unit must be active)',
    description:
      'Requires `Idempotency-Key`. 409 MASTER_DATA_NOT_RETIRED for an active asset; 422 INVALID_REFERENCE ' +
      'while its unit is retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AssetV2View> {
    return this.commands.restore(ctx, id);
  }
}
