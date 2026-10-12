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
  VerificationChecklistV2ChangeDto,
  VerificationChecklistV2CreateDto,
} from './rca-settings-v2.dto';
import { VerificationChecklistV2View } from './rca-settings-v2.view';
import { VerificationChecklistsV2Service } from './verification-checklists-v2.service';

/** Verification checklists of the acting plant (RCA settings in Master Data). */
@ApiTags('v2 · RCA Settings')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'verification-checklists', version: '2' })
export class VerificationChecklistsV2Controller {
  constructor(private readonly checklists: VerificationChecklistsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'List the verification checklists of the plant (keyset)',
    description:
      '`q` searches code and name; `status` = active | retired | all (default all).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: MasterDataListQueryDto,
  ): Promise<ListResponse<VerificationChecklistV2View>> {
    return this.checklists.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one verification checklist (ETag = row version)',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VerificationChecklistV2View> {
    return this.checklists.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create a verification checklist',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. 409 MASTER_DATA_CODE_EXISTS for a code in use.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: VerificationChecklistV2CreateDto,
  ): Promise<VerificationChecklistV2View> {
    return this.checklists.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Change a verification checklist (given `items` replace the list)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412). 409 MASTER_DATA_CODE_EXISTS, 409 MASTER_DATA_RETIRED.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: VerificationChecklistV2ChangeDto,
  ): Promise<VerificationChecklistV2View> {
    return this.checklists.change(ctx, { id, expectedVersion }, body);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Retire a verification checklist (templates keep naming it)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VerificationChecklistV2View> {
    return this.checklists.setActive(ctx, id, false);
  }

  @Post(':id/restore')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({ summary: 'Restore a retired verification checklist' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VerificationChecklistV2View> {
    return this.checklists.setActive(ctx, id, true);
  }
}
