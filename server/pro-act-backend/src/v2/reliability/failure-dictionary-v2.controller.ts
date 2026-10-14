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
import {
  FailureDictionaryChangeDto,
  FailureDictionaryCreateDto,
  FailureDictionaryImportDto,
  FailureDictionaryListQueryDto,
  FailureDictionaryRetireDto,
} from './failure-dictionary-v2.dto';
import { FailureDictionaryImportV2Service } from './failure-dictionary-import-v2.service';
import { FailureDictionaryV2Service } from './failure-dictionary-v2.service';
import {
  FailureDictionaryEntryV2View,
  FailureDictionaryImportV2View,
  toDictionaryView,
} from './failure-dictionary-v2.view';
import { DICTIONARY_WRITERS } from './reliability-roles';

/** The plant's ISO 14224-aligned failure dictionary (SME D11). */
@ApiTags('v2 · Failure dictionary')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'failure-dictionary', version: '2' })
export class FailureDictionaryV2Controller {
  constructor(
    private readonly dictionary: FailureDictionaryV2Service,
    private readonly importer: FailureDictionaryImportV2Service,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Dictionary entries in force (keyset; sort code, name or createdAt)',
    description:
      'Filters: `kinds`, `equipmentClass` (its items and modes plus those valid for every class), `q` (code ' +
      'and name), `at` (instant, default now) or `history=true` for every version. Tenant-wide master data.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: FailureDictionaryListQueryDto,
  ): Promise<ListResponse<FailureDictionaryEntryV2View>> {
    return this.dictionary.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'One entry version (ETag = row version); foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FailureDictionaryEntryV2View> {
    return toDictionaryView(await this.dictionary.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...DICTIONARY_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Add an entry to the dictionary',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. 409 DICTIONARY_CODE_EXISTS when the kind + class + ' +
      'code is in force; 422 INVALID_REFERENCE for an equipment class that is not in the dictionary.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: FailureDictionaryCreateDto,
  ): Promise<FailureDictionaryEntryV2View> {
    return toDictionaryView(await this.dictionary.create(ctx, body));
  }

  @Post('import')
  @HttpCode(200)
  @Idempotent()
  @Roles(...DICTIONARY_WRITERS)
  @ApiOperation({
    summary: 'Bulk upsert entries from JSON rows or CSV (all or nothing)',
    description:
      'Requires `Idempotency-Key`. New entries are created, changed ones get a new version from `effectiveFrom`, ' +
      'equal ones stay; entries missing from the document are kept. 422 DICTIONARY_IMPORT_INVALID lists the ' +
      'row problems (`details.errors`). `dryRun` counts without storing.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  importEntries(
    @Ctx() ctx: RequestContext,
    @Body() body: FailureDictionaryImportDto,
  ): Promise<FailureDictionaryImportV2View> {
    return this.importer.import(ctx, body);
  }

  @Patch(':id')
  @Roles(...DICTIONARY_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Change an entry: its version ends and the next version starts',
    description:
      'Requires `If-Match: "<rowVersion>"` of the entry in force (428 / 412). Returns the new version. 409 ' +
      'DICTIONARY_ENTRY_CLOSED for an ended entry; 422 when effectiveFrom is not after the version start.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: FailureDictionaryChangeDto,
  ): Promise<FailureDictionaryEntryV2View> {
    return toDictionaryView(
      await this.dictionary.change(ctx, { id, expectedVersion }, body),
    );
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...DICTIONARY_WRITERS)
  @ApiOperation({
    summary: 'End an entry (history and coded events stay)',
    description:
      'Requires `Idempotency-Key`. 409 DICTIONARY_CLASS_IN_USE for an equipment class with open items or ' +
      'modes; 409 DICTIONARY_ENTRY_CLOSED when already ended.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: FailureDictionaryRetireDto,
  ): Promise<FailureDictionaryEntryV2View> {
    return toDictionaryView(
      await this.dictionary.retire(ctx, id, body.effectiveTo),
    );
  }
}
