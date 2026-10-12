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
import { UnitV2ChangeDto, UnitV2CreateDto } from './unit-v2.dto';
import { UnitV2View } from './unit-v2.view';
import { UnitsV2CommandsService } from './units-v2-commands.service';
import { UnitsV2Service } from './units-v2.service';

/** Units for v2 screens: pickers (plan 3.2) and the master-data screens (list, detail, create, change, retire). */
@ApiTags('v2 · Units')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'units', version: '2' })
export class UnitsV2Controller {
  constructor(
    private readonly units: UnitsV2Service,
    private readonly commands: UnitsV2CommandsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List the units of the caller scope (keyset; sort createdAt, code or name)',
    description:
      'Tenant from the identity; a caller with unit-level grants sees only those units (`scope.unitIds`). ' +
      '`q` searches code and name; `status` = active | retired | all (default all).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: MasterDataListQueryDto,
  ): Promise<ListResponse<UnitV2View>> {
    return this.units.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one unit (ETag = row version); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitV2View> {
    return this.units.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create a unit in the acting plant',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant (403 TENANT_SCOPE_REQUIRED). 409 ' +
      'MASTER_DATA_CODE_EXISTS when another unit of the plant has the code (case-insensitive).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: UnitV2CreateDto,
  ): Promise<UnitV2View> {
    return this.commands.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Change a unit',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412 STALE_REVISION). 409 MASTER_DATA_CODE_EXISTS for a ' +
      'code in use, 409 MASTER_DATA_RETIRED for a retired unit.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: UnitV2ChangeDto,
  ): Promise<UnitV2View> {
    return this.commands.change(ctx, { id, expectedVersion }, body);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Retire a unit (history and references stay)',
    description:
      'Requires `Idempotency-Key`. 409 UNIT_HAS_ACTIVE_ASSETS (`details.activeAssets`) while the unit has ' +
      'active assets; 409 MASTER_DATA_RETIRED when already retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitV2View> {
    return this.commands.retire(ctx, id);
  }

  @Post(':id/restore')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Restore a retired unit',
    description:
      'Requires `Idempotency-Key`. 409 MASTER_DATA_NOT_RETIRED for an active unit.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitV2View> {
    return this.commands.restore(ctx, id);
  }
}
